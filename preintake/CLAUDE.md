# PreIntake.ai: Comprehensive Project Documentation

**Last Updated**: 2026-03-13
**Version**: 7.7 (Organic visitor demo experience + scraper audit)

---

## 🚦 Current Strategic Status: ACTIVE DEVELOPMENT

**Decision Date**: 2026-02-24
**Status**: Demo elimination pivot - direct landing page conversion
**Previous Status**: Was autonomous since 2026-01-31

### Rationale

After 15+ demo flow iterations with 0% completion rate, pivoting to direct landing page conversion:
- ✅ Email campaigns now link directly to landing page (no demo required)
- ✅ Personalized welcome banner for campaign visitors
- ✅ Direct path: Landing page → Create Account → Stripe checkout
- ✅ Demo still available via "View Demo" button for interested users
- ✅ 5 active bar scrapers continuously adding attorney contacts (calbar, flbar, ohbar, ncbar, wsba)
- ✅ Email campaign runs 4x daily Mon-Fri (domain warming complete)
- ✅ Analytics dashboard operational (GA4 + Firestore)

**Why this change:**
1. Demo asked users to CREATE value rather than SHOWING them value
2. 0% demo completion rate after 15+ optimization attempts
3. $99/month is low enough for direct conversion without extensive evaluation
4. Landing page already has 90% of what's needed to sell the product

### Monitoring Guidelines

| Metric | Check Frequency | Red Flag |
|--------|-----------------|----------|
| Email bounces/spam complaints | Weekly | >2% bounce or any spam complaints |
| Landing page visit rate | Weekly | Drops below 5% sustained |
| Create account click rate | Weekly | 0% over 100+ visits |
| Stripe checkout completion | Weekly | High abandonment rate |
| Scraper failures (5 active) | Weekly (GitHub Actions) | Multiple consecutive failures |
| First paying customer | Passive | 🎉 Celebrate |

**Note on Conversion Metrics:** The important engagement metrics are now:
- **Landing Page Visit**: Recipient clicked email CTA and loaded landing page
- **Create Account Click**: User clicked "Get Started" to begin checkout
- **Checkout Completed**: User completed Stripe payment

### Email Spam Monitoring (Automated)

**Daily automated spam test** ensures email deliverability:
- **Schedule**: Daily at 7:00 AM PT (GitHub Actions)
- **Workflow**: `.github/workflows/preintake-spam-monitor.yml`
- **Script**: `scripts/preintake-spam-monitor.js`

**How it works:**
1. Sends test email via Mailgun API (same pattern as campaign)
2. Waits 3 minutes for Gmail delivery
3. Uses Gmail API to check if email landed in inbox or spam
4. If spam detected: Sets `preintakeBatchSize` to 0 (disables campaign)
5. Sends alert email to `scscot@gmail.com`

**Re-enabling after spam issue resolved:**
1. Go to Firebase Console > Firestore > config > emailCampaign
2. Set `preintakeBatchSize` to previous value (stored in `preintakeBatchSize_previous_value`)
3. Delete the `preintakeBatchSize_disabled_*` fields

### Email Bounce Handling (Automated)

**Daily automated bounce sync** prevents sending to invalid addresses:
- **Schedule**: Daily at 5:00 AM PT (GitHub Actions)
- **Workflow**: `.github/workflows/sync-mailgun-failures.yml`
- **Script**: `scripts/sync-mailgun-failures.js`

**How it works:**
1. Queries Mailgun API for permanent failures (last 24 hours)
2. Filters for emails from `stephen@legal.preintake.ai`
3. Marks matching contacts in `preintake_emails` collection with:
   - `status: 'failed'`
   - `failReason: 'permanent_bounce'`
   - `failedAt: timestamp`
4. Campaign script skips contacts with `status: 'failed'`

**Manual run:**
```bash
node scripts/sync-mailgun-failures.js          # Live run
node scripts/sync-mailgun-failures.js --dry-run # Preview only
```

### Resume Development When

- First paying customer signs up (onboarding support needed)
- Email deliverability issues arise (bounce/spam spikes)
- Scraper breaks due to bar website changes
- Review date reached with sufficient data for optimization
- User requests specific feature or fix

---

## Table of Contents

1. [Product Overview](#product-overview)
2. [Customer Journey](#customer-journey)
3. [Practice Areas Supported](#practice-areas-supported)
4. [3-Gate Screening Process](#3-gate-screening-process)
5. [Pricing](#pricing)
6. [Target Customers](#target-customers)
7. [Market Research](#market-research)
8. [Strategic Recommendations](#strategic-recommendations)
9. [Implementation Status](#implementation-status)
10. [Architecture](#architecture)
11. [Security Features](#security-features)
12. [Demo Generation Flow](#demo-generation-flow)
13. [Lead Delivery Configuration](#lead-delivery-configuration)
14. [CRM Integration Research](#crm-integration-research)
15. [Compliance](#compliance)
16. [Deployment Model](#deployment-model)
17. [Current Gaps & Future Improvements](#current-gaps--future-improvements)
18. [Technical Reference](#technical-reference)
19. [Success Metrics](#success-metrics)
20. [Contact](#contact)

---

## Product Overview

### The Problem

Law firm intake staff spend hours qualifying leads that never sign. Meanwhile, real cases slip through because generic forms can't distinguish a strong case from a dead end.

**The math:**
- 60-70% of intake form submissions are unqualified
- Each unqualified call costs $25-50 in staff time
- Time-sensitive cases get lost in the noise
- 45% of law firms use 5-10+ fragmented technologies

Generic contact forms and chatbots don't solve this. They just flood your inbox faster—with no legal training and high error rates.

### The Solution

**AI that reviews inquiries like your best paralegal.**

Every inquiry delivered with a complete case summary, qualification assessment, and recommendation—ready for your review.

Unlike traditional forms or CRM intake tools, PreIntake.ai conducts a real conversation. It asks the right questions, adapts based on answers, and pre-evaluates every case before staff review:

| Routing | What It Means | What Happens |
|---------|---------------|--------------|
| **GREEN** | Strong case indicators | → Priority follow-up recommended |
| **YELLOW** | Needs documentation | → Queued for records review |
| **RED** | Cannot help | → Polite decline with resources |

**All inquiries are delivered to your team**—but each arrives pre-screened with a clear assessment and recommended action, so staff time goes to viable matters.

**Zero Data Retention** — Inquiries are processed and delivered immediately, never stored on our servers.

### How It's Different

**This is not another form builder or CRM.**

| Feature | Form Builders / CRMs | PreIntake.ai |
|---------|---------------------|--------------|
| Intake style | Static forms, fixed fields | Conversational AI that adapts to each case type |
| Screening | Generic lead scoring | Practice-area-specific legal screening |
| Disqualification | Manual review required | Instant (SOL, jurisdiction, conflicts, representation) |
| Output | Raw form data | Routing decision + plain-English rationale |
| Integration | Replaces your system | Feeds INTO your existing CRM |

**We sit in front of Lawmatics, Clio, or Filevine—not instead of them.**

Your CRM manages leads. We make sure only real cases get there in the first place.

### What You Get

**Branded Intake Page**
- Your firm's logo, colors, and messaging
- Mobile-optimized (60%+ of leads come from phones)
- Fast load time / Core Web Vitals compliant
- Jurisdiction-specific compliance disclaimers built in
- Hosted on our infrastructure—nothing to maintain

**CRM Integration**
- Webhook delivery to Lawmatics, Clio Grow, Filevine, or any system
- Green leads auto-route to your consultation calendar
- Structured case data—no more deciphering form submissions

**Analytics Dashboard** (`preintake-analytics.html`)
- ✅ AI Strategic Insights (Claude-powered analysis with actionable recommendations)
- ✅ GA4 website traffic (users, sessions, bounce rate, traffic sources)
- ✅ Email campaign metrics (sent, demo viewed, intake completed)
- ✅ Engagement funnel tracking (emails sent → demo viewed → intake completed)
- ✅ Source/state breakdown by bar association
- 🔮 Future: Green/Yellow/Red distribution, question flow A/B testing, ROI reporting

**Note:** "Demos generated" is not tracked as a metric because demos are auto-generated for all recipients before email send (~94% rate). The meaningful engagement metrics start at "demo viewed" (recipient clicked CTA).

---

## Customer Journey

### Overview

PreIntake.ai has two distinct customer acquisition flows:

**Flow A: Organic Visitors** (Google search, direct visit, referrals)
```
Homepage → "Get Started" → new-account.html → create-account.html → Stripe → payment-success.html
```

**Flow B: Email Campaign Visitors** (from bar scraper campaigns)
```
Email CTA → Homepage (?lead=) → "Get Started" → create-account.html → Stripe → payment-success.html
                              ↓
                              → "See How It Works – Live Demo" → /demo/?demo={leadId} (optional)
```

### Flow A: Organic Visitor Journey

**Phase 1: Discovery**

**Entry Points:**
- Google search → preintake.ai landing page
- Referral from existing customer
- LinkedIn outreach / sales call
- Legal tech conferences / webinars

**User Actions:**
- Views landing page (features, pricing, value proposition)
- Clicks "Get Started" (header nav or hero CTA)

### Phase 2: Registration (new-account.html)

**Page:** `/new-account.html`

**User Provides:**
- Full Name (required)
- Email (required, validated)
- Firm Name (optional - defaults to "{Name}, Attorney at Law")
- Primary Practice Area (required - dropdown with 41 options)
- Additional Practice Areas (optional - checkbox grid)
- Website URL (optional)

**Practice Area Options:**
- 39 standard practice areas (Administrative Law through Workers' Compensation)
- "General Practice" (for solo/generalist attorneys)
- "Other (specify)" (with custom text input)

**System Response:**
- Validates required fields
- Checks for existing account (duplicate handling)
- Calls `submitNewAccount` Cloud Function
- Creates `preintake_leads` document with `status: 'pending_payment'`
- Redirects to `/create-account.html?lead={leadId}`

**Duplicate Handling:**
- If email already exists in `preintake_leads`, returns existing `leadId`
- Frontend shows "Welcome back!" message
- Redirects to existing checkout page

### Phase 3: Payment

**Page:** `/create-account.html?lead={leadId}`

**Flow:**
1. User reviews pricing ($99/month)
2. Clicks "Continue to Payment" → Stripe Checkout
3. Stripe processes payment (monthly subscription)
4. Webhook (`checkout.session.completed`) → Updates Firestore
5. Redirect to `/payment-success.html`

**Account Activation:**
- `subscriptionStatus` set to `active`
- Customer receives activation email

### Flow B: Email Campaign Visitor Journey

**Phase 1: Email Click**

Email recipients from bar scraper campaigns receive personalized emails with direct links to the landing page including their `?lead=` parameter.

**Phase 2: Landing Page**

When visitors arrive with `?lead=` parameter:
- Personalized welcome banner displayed
- Hero CTA "Get Started" links to `/create-account.html?lead={leadId}`
- **Demo link displayed**: "See How It Works – Live Demo →" links to `/demo/?demo={leadId}`
- Direct path to create-account.html (skips new-account.html)

**Phase 3: Payment (or Demo)**

- **Direct conversion path**: "Get Started" → Stripe checkout and activation (same as Flow A Phase 3)
- **Optional demo path**: "See How It Works – Live Demo" → Demo page with sample report and live intake conversation

### Phase 4: Onboarding

**Page:** `/payment-success.html`

**What Customer Sees:**
- Account details (Firm Name, Plan, Lead Delivery Email)
- Embed code options (Floating Button, Inline Widget, Direct URL, iframe)
- Position options for button placement
- "Copy to Clipboard" functionality

**Immediate Access:**
- Live intake widget ready to embed
- Email delivery configured automatically
- No additional setup required

### Phase 5: Implementation

**Customer Actions:**
- Copies embed code from success page
- Adds script tag to their website (contact page, footer, etc.)
- Tests live intake with real conversation

**Embed Options:**
| Option | Code | Use Case |
|--------|------|----------|
| Floating Button | `<script src="https://preintake.ai/intake-button.js" data-firm="ID" data-position="bottom-right"></script>` | Persistent CTA on any page |
| Inline Widget | `<div id="preintake"></div><script src="https://preintake.ai/widget.js" data-firm="ID"></script>` | Dedicated contact page |
| Direct URL | `https://preintake.ai/demo/FIRM_ID` | Email links, QR codes |
| iframe | `<iframe src="https://preintake.ai/demo/FIRM_ID"></iframe>` | Maximum isolation |

### Phase 6: Lead Flow (Ongoing)

**Trigger:** Potential client completes intake conversation

**Flow:**
1. Visitor engages with intake widget
2. Conversational AI collects case information
3. Screening logic evaluates case strength
4. Assessment generated with routing (GREEN/YELLOW/RED)
5. Lead delivered via configured method (email default)

**Delivery Contents:**
- Contact information (name, phone, email)
- Case summary and key facts
- Screening assessment with rationale
- Full conversation transcript
- Urgency flags and recommended next action

**Post-Submission (Demo Mode):**
- Confirmation modal: "The intake lead has been sent to {email}"
- PreIntake.ai promo displayed

**Post-Submission (Live Mode):**
- "Return to {firmName}" button with link to firm website

### Phase 7: Subscription Management

**Billing:** Monthly via Stripe ($99/month, no setup fee)

**Customer Portal:** (Future)
- Manage payment method
- View billing history
- Upgrade/downgrade plans
- Cancel subscription

**Subscription Events Tracked:**
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

---

## Practice Areas Supported

**PreIntake.ai works with ANY legal practice area.** The system uses a flexible template architecture that adapts to any type of law firm.

### How It Works

1. **Specialized Templates**: Common practice areas have pre-built screening logic with practice-specific questions and qualification criteria
2. **Generic Template**: Any practice area not in the specialized list uses an intelligent generic template that adapts the conversation to that practice type
3. **Custom Configuration**: Firms can add any practice areas during setup—the system dynamically generates appropriate intake flows

### Practice Areas with Specialized Screening

These areas have deep, practice-specific question flows and qualification criteria:

| Practice Area | Key Screening Criteria |
|---------------|----------------------|
| **Personal Injury** | SOL, fault, injuries, insurance, existing representation |
| **Immigration** | Visa status, timeline, bars to admission, prior violations |
| **Family Law** | Jurisdiction, minor children, assets, urgency |
| **Bankruptcy** | Income, debt type, prior filings, asset protection |
| **Criminal Defense** | Charges, court dates, bail status, existing representation |
| **Tax/IRS** | Tax type, amount at stake, procedural posture |
| **Estate Planning** | Asset complexity, family dynamics, urgency |
| **Employment Law** | Discrimination type, timeline, documentation |
| **Workers' Compensation** | Injury type, employer response, medical treatment |
| **Real Estate** | Transaction type, timeline, disputes |

### Other Practice Areas

Any practice area not listed above (e.g., IP, Civil Litigation, Business Law, Entertainment Law, etc.) uses the generic template with:
- Standard contact collection
- Practice-type-aware case description questions
- Dynamic follow-up questions based on responses
- Universal qualification criteria (jurisdiction, representation status, urgency)

The generic template leverages Claude AI to ask intelligent follow-up questions relevant to the specific legal matter described.

---

## 3-Gate Screening Process

**Customized Per Practice Area**

### Gate 1: Hard Disqualifiers (< 60 seconds)
- Statute of limitations / deadline checks
- Jurisdiction verification
- Conflict of interest screening
- Existing representation check

### Gate 2: Case Strength Assessment
- Practice-specific liability/merit indicators
- Documentation and evidence availability
- Timeline and urgency factors

### Gate 3: Practical Viability
- Financial exposure vs. recovery potential
- Complexity assessment
- Collectability / ability to pay

**Output**: Structured data with routing recommendation, urgency flag, and plain-English rationale—delivered to your CRM automatically via webhook.

---

## Pricing

| Component | Amount |
|-----------|--------|
| **Monthly Subscription** | $99/mo |

**No setup fees. No long-term contracts.** Cancel anytime.

### Subscription Includes:
- Custom AI intake tailored to your firm's practice areas and branding
- Unlimited AI-powered intake screenings
- Real-time delivery via email or CRM
- Hosting and AI infrastructure
- Email support
- Ongoing updates and improvements
- Analytics dashboard

### The Math (ROI)

When you're spending $300-500 per lead, even small conversion improvements mean real money.

**Example scenario:**
- Current: 100 leads/month, 30 qualified, 10 consults, 5 signed
- After: 100 leads/month, 40 qualified*, 18 consults, 9 signed

*Not more qualified leads—better identification of existing qualified leads.*

**Result:** 4 additional signed cases/month × $15K average fee = **$60K incremental revenue**

**Your cost:** $99/month

**ROI:** 465:1

---

## Target Customers

### Good Fit
- Law firms spending $5K+/month on advertising
- Intake staff overwhelmed by lead volume
- Multi-practice firms wanting practice-specific screening
- Firms wanting measurable conversion data
- Partners tired of reviewing junk consultations

### Not a Fit
- Firms with < 20 leads/month (not enough volume to justify)
- Firms that want to review every submission personally
- Practices with highly unique intake needs (contact us—we may be able to help)

---

## Market Research

### Market Size & Growth

| Segment | 2025 Size | 2030 Projection | CAGR |
|---------|-----------|-----------------|------|
| Legal AI Software | $3.11B | $10.82B | **28.3%** |
| Legal Practice Management | $2.37B | $4.81B | 15.2% |
| US Legal Services | $396.8B | - | 2.5% |

**Key insight**: Legal AI is the fastest-growing segment at 28.3% CAGR.

### AI Adoption by Practice Area

| Practice Area | AI Adoption | Intake Complexity |
|---------------|-------------|-------------------|
| **Immigration** | **47%** (highest) | Very High |
| Personal Injury | 37% | High |
| Civil Litigation | 36% | High |
| Criminal Defense | 28% | High |
| Family Law | 26% | High |
| Estate Planning | 25% | Low-Medium |

**Key insight**: Immigration lawyers are the most AI-hungry (47%) but underserved by current tools.

### Competitive Landscape

| Competitor | Model | Price | Gap |
|------------|-------|-------|-----|
| Lawmatics | CRM + intake | Custom | Generic, not practice-specific |
| Clio Grow | Intake add-on | $59/user/mo | Limited for specialized practices |
| Smith.ai | AI + human receptionist | $95-292/mo | Phone-focused, not forms |
| Generic chatbots | Widget | Varies | No legal training, high error rate |

**Key insight**: No competitor offers practice-area-specific conversational AI intake that sits *in front of* CRMs.

### Pain Points (Opportunity)

1. **60-70% of intake submissions are unqualified** - massive waste
2. **AI error rates too high** - best legal AI scores 77.9% accuracy (unacceptable)
3. **Fragmented tools** - 45% of firms use 5-10+ different technologies
4. **No 24/7 coverage** - missed leads outside business hours
5. **Generic solutions fail** - practice-specific screening needed

### Geographic Considerations

- 8 states adding privacy laws in 2025
- SOL varies by state and case type
- Bar association rules differ by jurisdiction
- **Solution**: Configurable state/jurisdiction parameters, "strictest wins" compliance

---

## Strategic Recommendations

### Why Broaden Scope?

1. **Higher TAM**: ~1.3M lawyers in US vs ~50K California PI lawyers
2. **Immigration opportunity**: 47% AI adoption but underserved
3. **Architecture is modular**: Already proven with PI and Tax Litigation versions
4. **Competitive differentiation**: Practice-specific beats generic
5. **Pricing power**: Specialized tools command premium

### Recommended Practice Areas (Phase 1)

| Priority | Practice Area | Why |
|----------|---------------|-----|
| 1 | Personal Injury | Existing product, high ad spend, clear ROI |
| 2 | Immigration | Highest AI adoption (47%), complex intake, multilingual need |
| 3 | Family Law | High volume, sensitive screening needed |
| 4 | Bankruptcy | Clear qualification criteria, high conversion potential |
| 5 | Criminal Defense | Time-sensitive, clear disqualifiers |

---

## Implementation Status

### Phase 0: Documentation
- [x] Create `/preintake/PLAN.md` for project reference

### Phase 1: Foundation
- [x] Generalize preintake.html to be template-driven
- [x] Update preintake.md pitch for generalized product
- [x] Design landing page wireframe/copy

### Phase 2: Landing Page & Backend
- [x] Build preintake.ai landing page (`/preintake/index.html`)
- [x] Create prospect intake form with validation
- [x] Add spam protection (honeypot field, client-side rate limiting)
- [x] Add email validation with typo detection
- [x] Implement backend form handler (`submitDemoRequest` function)
- [x] Add server-side IP rate limiting via Firestore
- [x] Add law firm website validation (keyword-based)
- [x] Add email validation with MX record lookup
- [x] Configure Firebase hosting (`preintake-ai` target)
- [x] Set up separate Firestore database for preintake

### Phase 3: Website Analysis & Deep Research
- [x] Implement website analysis function (`analyzePreIntakeLead`)
- [x] Build deep research module (`deep-research-functions.js`)
  - [x] Page discovery (attorneys, practice areas, results, testimonials)
  - [x] Attorney extraction (names, titles, bios, photos)
  - [x] Practice area extraction
  - [x] Case results extraction (verdicts, settlements)
  - [x] Testimonial extraction
  - [x] Firm info extraction (years in business, locations)
  - [x] Claude Haiku structuring for extracted data

### Phase 4: Demo Generator
- [x] Build demo generation function (`generatePreIntakeDemo`)
- [x] Create demo intake template (`/functions/templates/demo-intake.html.template`)
- [x] Create demo config template (`/functions/templates/demo-config.js`)
- [x] Add email validation to demo intake chat interface
- [x] Configure Firebase Storage for demo hosting
- [x] Export functions in index.js

### Phase 5: Email Notifications
- [x] Demo confirmation email to prospect (on form submission)
- [x] New lead notification to Stephen (on form submission)
- [x] Demo ready notification to Stephen with demo URL
- [x] Demo ready notification to prospect with demo URL (`sendProspectDemoReadyEmail`)

### Phase 6: Practice Area Templates (Specialized + Generic)
- [x] Personal Injury (specialized, used as base)
- [x] Tax/IRS (specialized)
- [x] Immigration (specialized - system prompt + button detection)
- [x] Family Law (specialized - system prompt + button detection)
- [x] Bankruptcy (specialized - system prompt + button detection)
- [x] Criminal Defense (specialized - system prompt + button detection)
- [x] Estate Planning (specialized - system prompt + button detection)
- [x] Employment Law, Workers' Comp, Real Estate (specialized detection)
- [x] Generic Template (`getGenericPrompt`) - handles ANY other practice area dynamically

### Phase 7: Dynamic Practice Area Selection
- [x] After contact info collected, ask user to select their case type
- [x] Show buttons for each practice area from self-reported breakdown
- [x] Skip practice area question if firm only handles one area
- [x] Branch to practice-area-specific questions based on selection
- [x] Update `detectQuestionButtons` to show firm's practice areas dynamically
- [x] Embed practice area breakdown in generated demo config

### Phase 8: Intake Delivery System
- [x] Create `intake-delivery-functions.js` with `handleIntakeCompletion`
- [x] Email delivery with professional HTML summary (default for demos)
- [x] Generic webhook delivery for custom CRM integration
- [x] Update `demo-generator-functions.js` to set webhook URL
- [x] Store `deliveryConfig` in Firestore with lead document
- [x] Export `handleIntakeCompletion` in index.js
- [x] Deploy functions

### Phase 9: Account Creation & Payment
- [x] Create `/preintake/create-account.html` page
- [x] Create `/preintake/payment-success.html` page
- [x] Stripe integration (`stripe-functions.js`)
  - [x] `createCheckoutSession` - Creates Stripe Checkout session
  - [x] `getStripeConfig` - Returns publishable key and pricing info
  - [x] `stripeWebhook` - Handles subscription events (with signature verification)
  - [x] `verifyCheckoutSession` - Verifies payment status
- [x] Stripe webhook configured in Stripe Dashboard
- [x] Webhook signing secret stored as Firebase secret
- [x] Subscription status tracking in Firestore
- [x] Account activation email (customer + Stephen notification)
- [x] Payment success page refinements
- [ ] Delivery method selection (email, webhook, CRM) - Future
- [ ] CRM credentials input for direct integrations - Future

**Stripe Price IDs:**
| Environment | Monthly Subscription |
|-------------|---------------------|
| **Test** | `price_1SjNpAJaJO3EHqOSHh4DbhNM` |
| **Live** | `price_1SmPbhJBdoLMDposfgTFIJSA` |

**Stripe Email Settings** (Dashboard → Settings → Emails):
- "Send emails about upcoming renewals" — **Disabled** (Feb 21, 2026)
- Stripe auto-renewal reminder emails were unnecessary and confusing for auto-renewing subscriptions

**Firestore Subscription Fields** (in `preintake_leads` collection):
| Field | Description |
|-------|-------------|
| `status` | Overall lead status (`active`, `demo_ready`, etc.) |
| `subscriptionStatus` | Stripe subscription state (`active`, `canceled`, etc.) |
| `stripeCustomerId` | Stripe customer ID (e.g., `cus_...`) |
| `stripeSubscriptionId` | Stripe subscription ID (e.g., `sub_...`) |
| `deliveryEmail` | Email for lead delivery |
| `activatedAt` | Timestamp of account activation |
| `currentPeriodStart` | Subscription period start date |
| `currentPeriodEnd` | Subscription period end date |
| `conversionEmailSent` | Boolean - Conversion email already sent (prevents duplicates) |
| `conversionEmailSentAt` | Timestamp of conversion email delivery |

### Phase 10: Embeddable Widget
- [x] Create `intake-button.js` - floating button that opens intake modal
- [x] Create `widget.js` - inline widget with Shadow DOM encapsulation
- [x] Create `serveDemo` Cloud Function to proxy demo HTML
- [x] Add `/demo/:firmId` URL rewrite in Firebase hosting
- [x] Support 6 button positions
- [x] Create `EMBED-INSTRUCTIONS.md` documentation
- [x] Create `intake-button-test.html` for testing

### Phase 11: Website Expansion
- [x] Create shared header/footer component (`/preintake/js/components.js`)
- [x] Update landing page with header/footer, pricing, demo CTA
- [x] Create About Us page (`/preintake/about-us.html`)
- [x] Create Contact Us page (`/preintake/contact-us.html`)
- [x] Create FAQ page (`/preintake/faq.html`)
- [x] Create Privacy Policy page (`/preintake/privacy-policy.html`)
- [x] Create Terms of Service page (`/preintake/terms-of-service.html`)
- [x] Add data privacy language to intake page

### Phase 12: Enhanced Intake Email
- [x] Expand `complete_intake` tool schema with new fields
- [x] Update all 8 practice area prompts with case info instructions
- [x] Add `formatTranscript()` function to demo template
- [x] Add full conversation transcript to webhook payload
- [x] Redesign email template with professional styling

**Email Sections:**
```
1. Header - "New Intake Submission" + via PreIntake.ai
2. Qualification Badge - Green/Yellow/Red with confidence level
3. Contact Information - Name, Phone, Email
4. Screening Summary - 2-3 sentence narrative
5. Case Information - Case Type, Date, Location, SOL Status, Injuries, Treatment
6. Key Factors - Positive (green) and Negative (red) badges
7. Primary Strength/Concern - Yellow highlight box
8. Additional Comments - Blue highlight (if provided)
9. Full Conversation Transcript - Complete dialogue
10. Footer - Timestamp + PreIntake.ai branding
```

### Phase 13: Session Recovery, Deduplication & UX Enhancements
- [x] **Phone Number Validation** - US and international formats
- [x] **Email Header Simplification** - "Screening Summary" (removed "AI")
- [x] **Demo vs Live Mode Display Logic** - Runtime status check
- [x] **Additional Comments Feature** - GREEN/YELLOW leads only
- [x] **Multi-select Button Support** - `[OPTIONS-MULTI:]` format
- [x] **Deduplication** - Prevents duplicate intake emails
- [x] **Session Recovery** - 24-hour localStorage with recovery modal
- [x] **Demo Mode Confirmation Modal** - "Intake sent to {email}"

### Phase 14: SEO & Search Engine Optimization
- [x] **Meta Tag Optimization** - All pages updated with SEO-optimized titles, descriptions, keywords
- [x] **Canonical URLs** - Added to all indexable pages
- [x] **Open Graph Tags** - Social sharing optimization for all pages
- [x] **Schema.org Structured Data** - SoftwareApplication (index), FAQPage (faq)
- [x] **Noindex Tags** - Added to utility pages (create-account, payment-success, test pages)
- [x] **sitemap.xml** - Created with 6 indexable pages and priority levels
- [x] **robots.txt** - Created with sitemap reference and disallow rules
- [x] **Stripe Promo Codes** - Enabled `allow_promotion_codes: true` for discounts

### Phase 15: Project Audit (2025-12-30)
- [x] **Frontend HTML Audit** - Validated all 11 HTML files for structure and consistency
- [x] **Frontend JavaScript Audit** - Checked 4 JS files for syntax errors and patterns
- [x] **Backend Cloud Functions Audit** - Verified 8 function files and index.js exports
- [x] **Cross-file Consistency Check** - Confirmed pricing ($99/month, no setup fee) and email consistency
- [x] **Security Review** - Verified no hardcoded secrets, all use Firebase `defineSecret`
- [x] **Schema.org Fix** - Updated `priceValidUntil` from "2025-12-31" to "2026-12-31" (was expiring)
- [x] **OG Image Created** - Created `/preintake/images/og-image.png` (1200x630) for social sharing previews

### Phase 16: Branding & Icon (2025-12-30)
- [x] **Site Icon** - Created `/preintake/images/icon.svg` (gold #c9a962, filter funnel design)
- [x] **Favicon Integration** - Added favicon references to all 8 HTML pages
- [x] **Header Logo Icon** - Added icon inline with "PreIntake.ai" text in header
- [x] **Logo Size Increase** - Increased logo text and icon from 1.5rem to 1.75rem
- [x] **Header/Footer Background** - Changed from gradient to solid `#0a1628` for better contrast

### Phase 17: Email & UX Improvements (2025-12-31)
- [x] **Post-Demo Conversion Email** - Auto-send after first successful intake lead delivery
  - New `sendConversionEmail()` function in `intake-delivery-functions.js`
  - Tracks via `conversionEmailSent` and `conversionEmailSentAt` fields
  - Skips active/paid subscribers and already-sent leads
  - Subject: "Your PreIntake.ai Demo Just Captured a Lead"
  - CTA: Links to `https://preintake.ai/create-account.html?lead={leadId}`
- [x] **FROM Address Update** - Changed from `intake@preintake.ai` to `support@preintake.ai`
- [x] **Signature Update** - Changed from "Stephen Scott, Founder" to "Support Team, PreIntake.ai"
- [x] **JavaScript Parse Error Fix** - Escaped apostrophes in firm names that broke demo template
- [x] **Firm Name Extraction** - Improved extraction logic from analysis data
- [x] **Verification Email Re-click Fix** - Prevented page hang on second verification click
- [x] **Demo Template UI Fixes** - Fixed sidebar-cta centering and logo issues

### Phase 18: Email Outreach Campaign (2026-01-03)
- [x] **Email Campaign Script** - `scripts/send-preintake-campaign.js`
  - Sends outreach emails to law firms from Firestore `preintake_emails` collection
  - Uses Dreamhost SMTP via nodemailer (smtp.dreamhost.com:587)
  - Configurable batch size via `BATCH_SIZE` environment variable (default: 5)
  - 1-second delay between emails to avoid rate limiting
  - Tracks sent status, batch ID, message ID in Firestore
  - Template version: `v4-generic` (practice-agnostic messaging)
- [x] **GitHub Actions Workflow** - `.github/workflows/preintake-email-campaign.yml`
  - Scheduled: Mon-Fri, 4 runs/day morning window (PST: 7:30am, 9:00am, 10:00am, 11:30am PT)
  - Manual trigger with configurable batch size
  - Uses `PREINTAKE_SMTP_USER` and `PREINTAKE_SMTP_PASS` secrets
  - Uses `FIREBASE_SERVICE_ACCOUNT` for Firestore access
- [x] **Unsubscribe System**
  - Cloud Function: `handlePreIntakeUnsubscribe` (updates Firestore status)
  - Unsubscribe page: `preintake.ai/unsubscribe.html`
  - Email footer includes personalized unsubscribe link
- [x] **Email Deliverability** - Using Mailgun for legal.preintake.ai
  - SPF, DKIM, DMARC configured via Mailgun DNS records
  - All authentication checks passing
  - Domain switch from `law.preintake.ai` to `legal.preintake.ai` (Feb 28, 2026)
- [x] **GitHub Secrets Configured**
  - `MAILGUN_API_KEY`: Mailgun API key for legal.preintake.ai domain
  - `FIREBASE_SERVICE_ACCOUNT`: For Firestore access

**Email Templates (v9 - Feb 26, 2026):**
- From: Stephen Scott <stephen@legal.preintake.ai>
- **Subject Line (unified)**: "Pre-screen every inquiry before it reaches your team"
- **Messaging**: "Triage" framing - strongest matters rise to the top, practice-specific screening
- **CTA**: "Learn More" → preintake.ai landing page with UTM tracking (demos eliminated)
- **Key value props**: Case summary, qualification rating (qualified/needs review/not a fit), plain-English rationale
- **Trust signals**: Zero Data Retention, embeds on website OR works as hosted link
- **Performance**: 13.1% click rate (vs 3-4% baseline) - 3x improvement

**Firestore Collection:** `preintake_emails` (in `preintake` database)
| Field | Description |
|-------|-------------|
| `firmName` | Law firm name |
| `email` | Contact email |
| `sent` | Boolean - email sent |
| `status` | `pending`, `sent`, `failed`, `unsubscribed` (ONLY valid values) |
| `sentTimestamp` | When email was sent |
| `batchId` | Batch identifier |
| `messageId` | SMTP message ID |
| `subjectLine` | Subject line used |
| `templateVersion` | Template version (v9-landing-page current) |
| `randomIndex` | Random number for shuffled sending order |
| `failReason` | (optional) Reason for failure if status is `failed` |

**Data Quality Policy:**
- Valid status values are ONLY: `pending`, `sent`, `failed`, `unsubscribed`
- Records with invalid/corrupt data should be **deleted**, not marked with special status values
- The `audit-preintake-emails.js` script validates data integrity before campaign runs
- If a record cannot be sent (bad data, missing required fields), delete it or set `status: 'failed'` with `failReason`

**Dynamic Batch Size (updated 2026-02-09):**
- [x] **Firestore-Based Batch Size** - Domain warming automation
  - Batch size now read from Firestore `config/emailCampaign` document (in default TBP database)
  - Added `getDynamicBatchSize()` function to `scripts/send-preintake-campaign.js`
  - Uses secondary Firebase Admin app instance (`configApp`) to read from default database
  - Falls back to `BATCH_SIZE` environment variable if Firestore value not set
  - GitHub Actions workflow `.github/workflows/domain-warming-update.yml` updates `preintakeBatchSize` weekly
  - Domain warming schedule in `.github/warming-config.json` (reset 2026-02-09):
    | Week | Batch Size | Emails/Day |
    |------|------------|------------|
    | 1 | 100 | 400 |
    | 2 | 150 | 600 |
    | 3 | 225 | 900 |
    | 4+ | 300 | 1,200 |
  - **Monthly Projection** (at max): 300 × 88 runs (4/day × 22 days) = 26,400/month (53% of 50K Mailgun limit)
  - Batch size resolution: Firestore → .env fallback

### Phase 19: Homepage Conversion Optimization (2026-01-06)
- [x] **Section Reordering** - Optimized page flow for conversion
  - Moved "What Your Firm Receives" to first position below Hero
  - Moved "3 Simple Steps" after Routing Section (GREEN/YELLOW/RED)
  - Moved Demo Form immediately after "3 Simple Steps" as early conversion point
  - Practice Areas section follows Demo Form for those who scroll further
- [x] **Terminology Update** - Changed "What Your Team Receives" to "What Your Firm Receives" (legal-specific terminology)
- [x] **Hidden Sections** - Removed negative framing; value stands on its own
  - Stats Bar (commented out with HIDDEN label)
  - Problem Section (commented out with HIDDEN label)
  - CRM Integration Note (commented out with HIDDEN label)
- [x] **Sticky CTA Update** - Changed from "Free Demo →" to "See It In Action →" (matches hero button)
- [x] **Sitemap Update** - Updated homepage lastmod to 2026-01-06
- [x] **LinkedIn Ad Campaign Plan** - Documentation in `LINKEDIN_AD_CAMPAIGN_PLAN.md`
- [x] **Hero CTA Stacked Layout** - Redesigned hero button with two-line format
  - Primary: "See It In Action →" with arrow icon
  - Subtext: "Watch a real inquiry get evaluated and routed"
  - Removes ambiguity about what clicking the CTA will show
- [x] **Outcome Statement** - Added clarity line in demo section
  - "Within weeks, your staff spends time only on viable matters."
  - Answers "what's different after this runs?" question
- [x] **Pricing Section Simplified** - Reduced risk-reversal text to essentials
  - Changed from multi-sentence value recap to: "Cancel anytime—no long-term contracts."

### Phase 20: Hero Messaging Refinement (2026-01-08)
- [x] **H1 Messaging Update** - Refined hero heading with paralegal comparison
  - Changed from capability-focused to artifact-focused messaging
  - Final H1: "AI That Reviews Inquiries / Like Your Best Paralegal" (two lines on desktop)
  - Line break after "Inquiries" keeps "Like Your Best Paralegal" together
  - Added space before `<br>` to prevent "InquiriesLike" on mobile
  - Changed "Screens" → "Reviews" to eliminate filtering implication
- [x] **Subhead Update** - Describes what firm receives, not what AI does
  - "Every inquiry delivered with a complete case summary, qualification assessment, and recommendation—ready for your review."
- [x] **Zero Data Retention Trust Signal** - Added privacy assurance in hero
  - "Zero Data Retention — Inquiries processed and delivered, never stored."
  - Addresses law firm data security concerns
  - Styled with gold accent for emphasis
- [x] **Hero CTA Hidden** - Using sticky CTA instead for scroll engagement
  - Hero CTA commented out (available for restoration)
  - Sticky CTA appears after scroll: "See It In Action →"
- [x] **Section Padding Standardization** - Consistent spacing across all sections
- [x] **Filtering Language Audit** - Changed "screen/screening" → "review/reviewing" terminology throughout

### Phase 21: Demo Improvements & Analytics (2026-01-10)
- [x] **Template File Rename** - Renamed `demo-intake.html` → `demo-intake.html.template`
  - Suppresses VS Code JavaScript validation errors on `{{placeholder}}` syntax
  - Updated all code references in `demo-generator-functions.js` and `regenerate-demos.js`
- [x] **Conditional Header Button** - Dynamic "Get Started" CTA for campaign visitors
  - Header shows "My Account" by default
  - After user clicks Campaign Hero CTA, header changes to "Get Started →"
  - Uses `sessionStorage` key `tbp_demo_viewed` to track demo views
  - Links directly to `create-account.html?lead={leadId}`
  - Gold gradient styling (`.nav-get-started` class) for prominent CTA
- [x] **Demo Regeneration Utility** - `scripts/regenerate-preintake-demos.js`
  - Regenerates all demos with latest template (fixes missing onboarding modal)
  - Supports dry-run mode: `node scripts/regenerate-preintake-demos.js`
  - Run mode: `node scripts/regenerate-preintake-demos.js --run`
  - Specific lead: `node scripts/regenerate-preintake-demos.js --run --id=LEAD_ID`
  - All 12 existing demos regenerated with updated template
- [x] **Email Analytics Dashboard** - `preintake/preintake-analytics.html`
  - Campaign performance tracking (visits, demo views, conversions)
  - Integrates with GA4 data
- [x] **Click Rate Analysis** - `scripts/analyze-click-rate.js`
  - Analyzes email campaign click-through rates

### Phase 22: Pre-Screen Positioning & Audit Fixes (2026-01-10)
- [x] **H1 Messaging Update** - Changed from "Screen" to "Pre-Screen" positioning
  - Final H1: "Pre-Screen Every Inquiry Before They Reach Your Firm"
  - "Pre-Screen" clarifies position: happens BEFORE staff/CRM/time wasted
  - Aligns with "sits in front of CRMs" architecture narrative
  - Uses industry-standard legal ops terminology (pre-screened cases/leads)
  - Implies gate/evaluation, not blocking - reduces objection
- [x] **Hero Subtitle Enhancement** - Added practice-area differentiation
  - "Every inquiry assessed and delivered with a case summary tailored to your firm's practice area, a qualification rating, and a clear next-step recommendation—qualified, needs review, or not a fit."
  - Highlights core differentiator (practice-area specific screening)
  - "your firm's" for direct, personal tone
  - "clear next-step recommendation" more actionable than generic "recommendation"
- [x] **Cloud Functions Audit Fixes**
  - Fixed SMTP host default in `preintake-functions.js` (mail.preintake.ai → smtp.dreamhost.com)
  - Fixed `generateSystemPrompt()` signature mismatch in `widget-functions.js` (9 args → 7 args)
  - Added separate try-catch for email sending in `demo-generator-functions.js`
  - Enhanced `initFirebaseAdmin()` JSDoc for script usage clarity
- [x] **Sitemap Update** - Updated homepage lastmod to 2026-01-10

- [x] **Email Campaign Share Line** - Added forward/share encouragement to outreach emails
  - "If you're not the right contact for intake, feel free to forward this email — the demo link above is specific to **${firmName}**."
  - Plain-text URL below for forwarded emails where button may not render
  - Only added to personalized demo template (not fallback template)
  - Rationale: Law firms are multi-stakeholder; first reader often isn't decision-maker

### Phase 23: Email & Homepage Messaging Alignment (2026-01-10)
- [x] **Homepage Metadata Fix** - Updated meta/OG/Twitter descriptions to match "Pre-screen" terminology
- [x] **Email Subject Line Update** - "Pre-screen every inquiry before it reaches your team"
- [x] **Email Template Refresh** - Updated header, body, CTA, preheader for Pre-Screen positioning
- [x] **Zero Data Retention Trust Signal** - Added to both email templates
- [x] **CAN-SPAM Compliance** - Added physical mailing address to email footer
  - "PreIntake.ai · 1543 Hamner Ave #247 · Norco, CA 92860"
  - Required for commercial email compliance
- [x] **Plain-Text Fallback** - Added `generateEmailPlainText()` and `generateFallbackEmailPlainText()` functions
  - Improves deliverability (some spam filters check for text version)
  - `sendEmail()` now sends multipart emails (HTML + plain-text)
- [x] **Template Version Update** - Changed from `v5-personalized-demo` to `v6-personalized-demo`
  - Tracks email template evolution for analytics

### Phase 24: CalBar Attorney Scraper (2026-01-14)
- [x] **CalBar Scraper** - `scripts/scrape-calbar-attorneys.js` (CSS email obfuscation handling)
- [x] **GitHub Actions** - `.github/workflows/calbar-scraper.yml` (Daily 2am PST)
- [x] **Website Inference** - `scripts/infer-calbar-websites.js` (Daily 3am PST)
- **Source**: `"calbar"`, **State**: `"CA"`, 25 practice areas in 2 tiers

### Phase 25: Florida Bar Attorney Scraper (2026-01-14)
- [x] **FL Bar Scraper** - `scripts/scrape-flbar-attorneys.js` (Cloudflare email obfuscation, two-step scrape)
- [x] **GitHub Actions** - `.github/workflows/flbar-scraper.yml` (Daily 2am PST)
- [x] **Profile Enrichment** - `scripts/enrich-flbar-profiles.js` + workflow (2-min intervals for rate limiting)
- **Source**: `"flbar"`, **State**: `"FL"`, 12 practice areas (B37=PI, B28=Immigration, etc.)

### Phase 26: Website Validation & UX Improvements (2026-01-15)
- [x] **JavaScript-Heavy Site Validation Fix** - Added `stripNonContentHtml()` to handle Wix/Squarespace/React sites
- [x] **Verification Email Text Simplification** - Cleaner, more user-focused copy

### Phase 27: Demo View Tracking Improvement (2026-01-16)
- [x] **View Tracking Moved to "Start Demo" Click** - More accurate engagement metrics (visit vs view distinction)
- [x] **Cross-Frame postMessage Implementation** - Demo iframe communicates with parent window
- [x] **Bulk Demo Update Script** - `scripts/update-demo-postmessage.js` updated 156 demos

### Phase 28: Demo UX Improvements (2026-01-18)
- [x] **Duplicate Demo Redirect** - Auto-route users to existing demos (409 response handling)
- [x] **Exit Confirmation Modal** - Prevent premature demo abandonment with confirmation prompt
- [x] **Demo Template postMessage Enhancements**
  - Added `firmEmail` to `demo-started` postMessage for exit confirmation
  - Added new `intake-completed` postMessage when webhook succeeds
  - Parent window tracks completion state (`demoIntakeCompleted`, `demoFirmEmail`)
- [x] **Email URL Enhancement** - Added `&firm=` parameter to demo URLs
  - Campaign emails now include firm name in demo link
  - Homepage shows "Welcome [firmName]" banner immediately on click
  - URL format: `?demo={leadId}&firm={firmName}&utm_source=email...`
- [x] **Bulk Demo Regeneration** - Updated all 160 demos with new template
- [x] **Dynamic Sidebar Progress Steps** - Multi-practice firm UX enhancement (`isMultiPractice` flag)
- [x] **Firm-Specific Practice Area Detection** - Fixed sidebar via `FIRM_PRACTICE_AREAS` array injection

### Phase 29: Bar Profile Demos & Hosted Intake URLs (2026-01-18)
- [x] **Bar Profile Demo Generation** - `generateBarProfileDemo()` for attorneys WITHOUT websites
- [x] **Practice Area Mapping** - `mapBarPracticeArea()` normalizes bar practice areas
- [x] **3-Phase Email Campaign Priority** - Website contacts → Bar profile contacts → Fallback email
- [x] **Hosted Intake URLs** - `serveHostedIntake` Cloud Function at `/intake/:barNumber`
- [x] **Stripe Checkout Updates** - Stores `hasWebsite`, `deliveryMethod`, `hostedIntakeUrl`
- [x] **Payment Success Page** - Dual-path UI (embed vs hosted)

### Phase 30: 6-Digit Intake Codes & Short URLs (2026-01-19)
- [x] **6-Digit Intake Codes** - `generateUniqueIntakeCode()` creates human-friendly short URLs (excludes O/0/I/1/L)
- [x] **Short URL Routing** - `preintake.ai/{code}` → `serveIntakeByCode` Cloud Function
- [x] **Resend Activation Email** - Admin endpoint `resendActivationEmail` for re-sending activation emails
- **Collections**: `preintake_intake_codes` lookup table, `intakeCode` field on leads

### Phase 31: Firm Name Styling & Campaign Consolidation (2026-01-20)
- [x] **Option 5 Firm Name Styling** - Border frame + serif font for all demo firm name locations
- [x] **Email Campaign Query Consolidation** - Single parallel query combining website + bar profile contacts
- [x] **Bar Profile Email Messaging Update** - Improved copy for attorneys without websites

### Phase 32: Ohio Bar Attorney Scraper (2026-01-20)
- [x] **Ohio Bar Scraper** - `scripts/scrape-ohiobar-attorneys.js` (Puppeteer, React SPA checkbox filtering)
- [x] **GitHub Actions** - `.github/workflows/ohbar-scraper.yml` (Daily 4am PST)
- **Source**: `"ohbar"`, **State**: `"OH"`, 46 practice areas with city subdivision for 100+ result caps

### Phase 33: Michigan Bar Attorney Scraper (2026-01-20)
- [x] **Michigan Bar Scraper** - `scripts/scrape-mibar-attorneys.js` (ReliaGuide platform, vCard API)
- [x] **GitHub Actions** - `.github/workflows/mibar-scraper.yml` (Daily 6am PST)
- **Source**: `"mibar"`, **State**: `"MI"`, 21 practice areas via ReliaGuide category IDs
- **vCard API**: `/api/public/profiles/{id}/download-vcard` provides email, phone, firm, website

### Phase 34: Missouri Bar Attorney Scraper (2026-01-21)
- [x] **Missouri Bar Scraper** - `scripts/scrape-mobar-attorneys.js` (ASP.NET WebForms, GridView/FormView)
- [x] **GitHub Actions** - `.github/workflows/mobar-scraper.yml` (Daily 3am PST)
- **Source**: `"mobar"`, **State**: `"MO"`, 26 practice areas, no pagination (all results on single page)

### Phase 35: Kentucky Bar Attorney Scraper (2026-01-22)
- [x] **Kentucky Bar Scraper** - `scripts/scrape-kybar-attorneys.js` (DNN/CV5 iframe, AJAX pagination)
- [x] **GitHub Actions** - `.github/workflows/kybar-scraper.yml` (Daily 9am PST, 90-min timeout)
- **Source**: `"kybar"`, **State**: `"KY"`, 20 practice areas with county subdivision for 500+ results
- **Optimization**: Pre-loaded email deduplication (Phase 48) - loads all emails into memory Set at startup

### Phase 36: Georgia Bar Attorney Scraper (2026-01-22)
- [x] **Georgia Bar Scraper** - `scripts/scrape-gabar-attorneys.js` (Puppeteer, JS-rendered directory)
- [x] **GitHub Actions** - `.github/workflows/gabar-scraper.yml` (Daily 10am PST)
- **Source**: `"gabar"`, **State**: `"GA"`, 20 member groups with hash-based profile IDs

### Phase 37: Illinois Bar Attorney Scraper (2026-01-22)
- [x] **Illinois Bar Scraper** - `scripts/scrape-ilbar-attorneys.js` (ReliaGuide platform, Puppeteer + vCard API)
- [x] **GitHub Actions** - `.github/workflows/ilbar-scraper.yml` (Daily, time offset)
- **Source**: `"ilbar"`, **State**: `"IL"`, same 20 categories as Michigan Bar (ReliaGuide shared IDs)
- **Note**: Rewritten multiple times (Jan 2026): REST API → Puppeteer + vCard due to aggressive rate limiting; added category validation with safety valve

### Phase 38: Indiana Bar Attorney Scraper (2026-01-22)
- [x] **Indiana Bar Scraper** - `scripts/scrape-inbar-attorneys.js` (ReliaGuide platform, vCard API)
- [x] **GitHub Actions** - `.github/workflows/inbar-scraper.yml` (Daily, time offset)
- **Source**: `"inbar"`, **State**: `"IN"`, **UNIQUE**: No practice areas exposed - scrapes ALL attorneys

### Phase 39: Mississippi Bar Attorney Scraper (2026-01-22)
- [x] **Mississippi Bar Scraper** - `scripts/scrape-msbar-attorneys.js` (ReliaGuide platform, vCard API)
- [x] **GitHub Actions** - `.github/workflows/msbar-scraper.yml` (Daily 2pm PST)
- **Source**: `"msbar"`, **State**: `"MS"`, same 20 categories as Michigan Bar + Insurance (214)
- **Note**: Requires non-headless browser (`xvfb-run` in CI) - MS Bar detects headless mode

### Phase 40: Nebraska Bar Attorney Scraper (2026-01-22)
- [x] **Nebraska Bar Scraper** - `scripts/scrape-nebar-attorneys.js` (ReliaGuide platform, vCard API)
- [x] **GitHub Actions** - `.github/workflows/nebar-scraper.yml` (Daily, time offset)
- **Source**: `"nebar"`, **State**: `"NE"`, 18 practice areas via keyword matching (no category URL filtering)

### Phase 41: North Carolina Bar Attorney Scraper (2026-01-22)
- [x] **North Carolina Bar Scraper** - `scripts/scrape-ncbar-attorneys.js` (Custom portal, NOT ReliaGuide)
- [x] **GitHub Actions** - `.github/workflows/ncbar-scraper.yml` (Daily, time offset)
- **Source**: `"ncbar"`, **State**: `"NC"`, 18 specializations via dropdown selector

### Phase 42: Oklahoma Bar Attorney Scraper (2026-01-23)
- [x] **Oklahoma Bar Scraper** - `scripts/scrape-okbar-attorneys.js` (ASP.NET WebForms, GUID practice areas)
- [x] **GitHub Actions** - `.github/workflows/okbar-scraper.yml` (Daily 5am PST)
- **Source**: `"okbar"`, **State**: `"OK"`, 28 practice areas with GUID values

### Phase 43: Washington State Bar Attorney Scraper (2026-01-23)
- [x] **Washington State Bar Scraper** - `scripts/scrape-wsba-attorneys.js` (ASP.NET WebForms, ViewState pagination)
- [x] **GitHub Actions** - `.github/workflows/wsba-scraper.yml` (Daily 8pm PST)
- **Source**: `"wsba"`, **State**: `"WA"`, 24 practice areas with slug-based values

### Phase 44: Nebraska State Bar Association Attorney Scraper (2026-01-24)
- [x] **Nebraska State Bar Scraper** - `scripts/scrape-nsba-attorneys.js` (YourMembership platform, Caesar cipher emails)
- [x] **GitHub Actions** - `.github/workflows/nsba-scraper.yml` (Daily 5am PST)
- **Source**: `"nsba"`, **State**: `"NE"`, iframe-based search with button pagination

### Phase 45: Government Contact Filtering (2026-01-24)
- [x] **Shared Filter Module** - `scripts/gov-filter-utils.js`
  - Email domain patterns: `.gov`, `.mil`, `.state.XX`, `.us`, courts, etc.
  - Firm name patterns: public defender, district attorney, court, etc.
  - Exports: `isGovernmentContact()`, `isGovernmentEmail()`, `isGovernmentFirm()`
- [x] **Cleanup Script** - `scripts/cleanup-gov-contacts.js` (removed 622 existing government contacts)
- [x] **Audit Script** - `scripts/audit-gov-contacts.js` for ongoing auditing
- [x] **All 14 Bar Scrapers Updated** - Skip government contacts at scrape time
  - Applied to: calbar, flbar, gabar, ilbar, inbar, kybar, mibar, mobar, msbar, ncbar, nebar, ohiobar, okbar, wsba

### Phase 46: Scraper Optimizations & Reliability (2026-01-25/26)
- [x] **Workflow Cron Fixes** - Fixed schedule registration for kybar, mobar, nsba, okbar workflows
  - Offset conflicting cron times: okbar 13:00→15:00 UTC, kybar 16:00→17:00 UTC
- [x] **WSBA Scraper Timing** - Optimized delays to prevent timeout cancellation
  - Reduced profile fetch timeout (30s→15s), post-profile wait (1000→500ms), between-profile delay (1500→800ms)
  - Workflow timeout increased to 120 minutes
- [x] **Ohio Bar Scraper** - Expanded OHIO_CITIES from 49 to 167 (all cities with 10K+ population)
  - MAX_COMBOS increased from 5 to 100 (20x faster daily progress)
- [x] **Kentucky Bar Scraper** - Counties sorted by population descending for faster yield
  - Further optimization with pre-loaded email deduplication in Phase 48
- [x] **IL Bar Scraper Rewrite** - Multiple iterations for reliability
  - REST API → Puppeteer + vCard (due to rate limiting) → final version with category validation
- [x] **NC Bar Scraper Rewrite** - Re-enabled and rewritten with improved pagination
- [x] **Category Validation with Safety Valve** - Added to IL, MI, MS ReliaGuide scrapers
  - Validates hardcoded practice area categories against live search results before scraping
  - Valid/invalid results cached in Firestore progress documents
  - Safety valve: if ALL categories return 0 results, falls back to using all categories
- [x] **Disabled Complete Scrapers** - Workflows renamed to `.yml.disabled` (10 total)
  - Georgia (`gabar-scraper.yml.disabled`) - fully complete
  - Illinois (`ilbar-scraper.yml.disabled`) - fully complete
  - Indiana (`inbar-scraper.yml.disabled`) - fully complete
  - Kentucky (`kybar-scraper.yml.disabled`) - fully complete
  - Michigan (`mibar-scraper.yml.disabled`) - fully complete
  - Mississippi (`msbar-scraper.yml.disabled`) - 20/20 categories, 283 attorneys
  - Missouri (`mobar-scraper.yml.disabled`) - fully complete
  - Nebraska (`nebar-scraper.yml.disabled`) - fully complete
  - Nebraska State Bar Association (`nsba-scraper.yml.disabled`) - fully complete
  - Oklahoma (`okbar-scraper.yml.disabled`) - fully complete
- [x] **New Utility Scripts** - `scripts/fetch-bar-categories.js` and `scripts/fetch-bar-categories-2.js`
  - Fetch and validate practice area categories from ReliaGuide and other bar association websites
  - Used for verifying hardcoded category IDs match live data

### Phase 47: Email Analytics & Tracking Migration (2026-01-26)
- [x] **PreIntake Campaign Tracking Update** - Disabled Mailgun tracking in `send-preintake-campaign.js`
  - Set `o:tracking`, `o:tracking-opens`, `o:tracking-clicks` to `'no'`
  - Using Firestore-based tracking instead (`trackDemoView`: visit on page load, view on demo start)
- [x] **Email Analytics Dashboard Overhaul** - `preintake/preintake-analytics.html`
  - Renamed from "Email Campaign Analytics" to "Campaign Analytics"
  - Migrated backend from Mailgun API to GA4 Data API
  - Added big number cards, section headers, accent styling
  - New metrics: 7-day/today/yesterday GA4 website analytics for preintake.ai
- [x] **Widget Functions GA4 Migration** - `functions/widget-functions.js`
  - `getEmailAnalytics` endpoint migrated from Mailgun stats to GA4 Data API
  - Uses `BetaAnalyticsDataClient` with GA4 property ID `517857439`
  - Fetches overview metrics (7-day, today, yesterday) and traffic source breakdown

### Phase 48: Scraper Performance Optimization (2026-01-30)
- [x] **Pre-loaded Email Deduplication** - Implemented in Kentucky Bar scraper
  - Replaced individual Firestore queries with in-memory Set lookup (O(1) vs O(n))
  - New functions: `preloadExistingEmails()`, `emailExists()`, `markEmailAsInserted()`
  - Loads all existing emails at startup (~17K records in ~2-3 seconds)
  - Eliminates per-profile Firestore roundtrip that caused 90-minute timeout
  - Expected 5-10x speedup for scrapers with high duplicate rates
  - Pattern can be applied to other scrapers experiencing timeout issues

**Pre-loaded Email Deduplication Pattern:**
```javascript
// In-memory Set of existing emails for fast lookup
let existingEmailsSet = null;

async function preloadExistingEmails() {
    existingEmailsSet = new Set();
    const snapshot = await db.collection('preintake_emails')
        .select('email')  // Only fetch email field
        .get();
    snapshot.forEach(doc => {
        const email = doc.data().email;
        if (email) existingEmailsSet.add(email.toLowerCase());
    });
}

function emailExists(email) {
    return existingEmailsSet.has(email.toLowerCase());
}

function markEmailAsInserted(email) {
    if (existingEmailsSet) existingEmailsSet.add(email.toLowerCase());
}
```

### Phase 49: Email Campaign User Flow Analysis (2026-01-31)
- [x] **User Flow Audit** - Analyzed `send-preintake-campaign.js` conversion funnel
  - Email click rate: 10.9% (solid for cold outreach)
  - Visit-to-view rate: 25% (intentional design - allows brand validation)
  - Homepage bounce rate: 70.3%
- [x] **Verified Design Decisions**
  - Auto-open demo intentionally reverted to allow brand validation
  - `?autoopen=true` parameter exists but only used for "View Demo Again" button
  - Campaign visitors see "Begin Your Custom Demo" CTA after page load
- [x] **Bar Profile Personalization Confirmed**
  - `generateBarProfileDemoForContact()` creates demos branded with attorney name + practice area
  - Subject line "I built you a personalized intake demo" is accurate
- [x] **Generic Fallback Phased Out**
  - Query logic only fetches contacts with `website != ''` OR `domainChecked == true`
  - 68 v6-generic emails in analytics are legacy from before bar profile system

**Email Campaign User Flow (Current Architecture — as of Phase 53):**
```
Email Sent → Link Clicked → Homepage (?demo=) → REDIRECT → /demo/?demo={id}&firm={name}
  → Demo Page Welcome Screen → "Start Demo" Click → Iframe Loads → Intake Completed
  → OR Header Nav / "Explore" → sessionStorage + ?explore=1 → Destination shows banner + floating buttons
```

**Campaign Visitor Detection (index.html → /demo/index.html):**
- `?demo={leadId}` on homepage triggers redirect to `/demo/?demo={id}&firm={name}`
- Demo page shows full-page welcome screen with firm name, 3-step instructions
- User clicks "Start Demo" → iframe loads with `skip_onboarding=true`
- Exit confirmation modal prevents abandonment during active demo
- Header navigation stores context in sessionStorage and navigates with `?explore=1`

**Template Distribution (as of 2026-02-26):**
| Template | Purpose | Usage |
|----------|---------|-------|
| v9-landing-page | All contacts (unified) | 100% |

*Note: Previous v6/v7/v8 templates deprecated. All emails now use unified v9-landing-page template with "triage" messaging and direct landing page conversion.*

**Tracking Flow (updated in Phase 53):**
1. `trackDemoView?type=visit` - On `/demo/` page load with `?demo=`
2. `trackDemoView?type=view` - On "Start Demo" click on `/demo/` page
3. `trackDemoView?type=explore` - When user leaves demo to explore site
4. `sessionStorage.tbp_demo_viewed` - Set on "Start Demo" click, triggers "Get Started →" in header
5. `sessionStorage.tbp_demo_id` - Set on navigation away, triggers welcome banner + floating buttons

### Phase 50: Welcome Banner CTA (2026-01-31)
- [x] **Welcome Banner CTA** - Made banner actionable for campaign visitors
  - Banner now shows: "Welcome, [Name] — Your demo is ready [Start Now →]"
  - CTA button triggers `reopenDemoModal()` directly from banner
  - Suffix and CTA hidden by default, shown only for `?demo=` visitors
  - `cleanFirmNameForDisplay()` strips ", Attorney at Law" suffix for bar profile contacts
  - CSS: Flexbox layout, white button text on dark background, responsive mobile styling

### Phase 51: Pre-Demo Screen & Onboarding Refactor (2026-02-03)
- [x] **Problem**: 42 campaign leads visited via email `?demo=` links but 0 started the demo (0% demo start rate)
  - Two-layer modal UX problem: parent overlay → iframe → onboarding modal inside iframe
  - Users saw the onboarding screen inside the iframe but never clicked "Start Demo"
- [x] **Pre-Demo Screen (Parent Page)** - Native HTML welcome screen shown before iframe loads
  - Added `<div id="demo-pre-screen">` inside `.demo-modal-container` with:
    - PreIntake.ai logo, "Welcome to Your Demo" heading, firm name display
    - 3 numbered instruction steps (Try Conversation, See Assessment, Receive Summary)
    - "Start Demo" button, "I'll explore the site first" escape link
  - CSS: ~140 lines in `preintake/css/styles.css` (`.demo-pre-screen` classes, mobile responsive)
- [x] **Skip Onboarding in iframe** - `functions/templates/demo-intake.html.template`
  - Added `skip_onboarding=true` URL parameter detection at start of onboarding IIFE
  - When detected: hides onboarding modal, sends `demo-started` postMessage with `firmEmail`, returns early
  - When NOT detected (direct URL visitors): existing behavior unchanged
- [x] **JS Refactor** - Replaced single `openDemoModal()` with three functions in `checkCampaignDemo()`:
  - `showPreDemoScreen()` — shows native pre-demo screen, no iframe loaded
  - `loadDemoIframe()` — tracks view, updates header to "Get Started →", hides pre-screen, loads iframe with `skip_onboarding=true`
  - `reopenDemoModal()` — shows iframe directly if already loaded, otherwise shows pre-screen
  - View tracking (`trackDemoView?type=view`) moved from iframe postMessage to parent's "Start Demo" button click
  - `demo-started` postMessage handler simplified (only captures `firmEmail`)
  - `forceCloseDemoModal()` updated to also hide pre-screen
  - `getPreIntakeFirmStatus` response populates `deliveryEmail` on pre-screen (no backend changes needed)
- [x] **Demo Regeneration** - 473 existing demos regenerated with updated template
  - `node scripts/regenerate-preintake-demos.js --run`
  - All demos now recognize `skip_onboarding=true` parameter
- [x] **Email Analytics Cleanup** - Removed legacy A/B test section from `preintake-analytics.html`
  - Removed V1/V2 ("Not an opportunity" / "What if your next recruit") table (legacy subject lines)

**Data Flow (Phase 51 — superseded by Phase 53):**
```
NOTE: Phase 51 implemented pre-demo screen as a modal overlay on index.html.
Phase 53 replaced this with a dedicated /demo/index.html page.
The modal code on index.html is now unreachable (redirect to /demo/ happens first).
See Phase 53 for current architecture.
```

**Deploy Order:**
1. `firebase deploy --only functions` — template change
2. Demo regeneration (already completed — 473 demos)
3. `firebase deploy --only hosting:preintake-ai` — parent page + CSS

### Phase 52: Email Campaign Schedule Optimization (2026-02-03/04, updated 2026-02-26)
- [x] **4 Runs/Day** - Concentrated in morning window for better engagement
  - PST times: 7:30am, 9:00am, 10:00am, 11:30am PT
  - PDT times: 6:30am, 8:00am, 9:00am, 10:30am PT (1hr earlier, still morning)
  - Morning sends complete before noon when attorneys are most responsive
- [x] **Weekday-Only Sending** - Reverted from 7 days/week to Mon-Fri
  - Law firms closed weekends; weekend emails get buried in Monday inbox
  - Lower weekend engagement hurts sender reputation
- [x] **Removed PT Time Window Check** - Script no longer enforces time windows internally
  - Deleted `checkPTBusinessWindow()` function and `SKIP_TIME_CHECK` env var
  - Scheduling now handled entirely by GitHub Actions cron (4 direct triggers, not DST dual-triggers)
  - Simpler architecture: cron fires → script runs immediately (no time validation)
- [x] **Workflow Cron Simplified** - `.github/workflows/preintake-email-campaign.yml`
  - 4 cron entries at fixed UTC offsets, Mon-Fri (`1-5`)
  - `cron: '30 16 * * 1-5'`, `'30 18 * * 1-5'`, `'30 20 * * 1-5'`, `'30 22 * * 1-5'`
  - During PDT (Mar-Nov), sends shift 1 hour earlier — still within business hours
- **Net effect**: 4 runs x batch x 5 days vs previous 2 runs x batch x 7 days
  - At week 4 (batch=40): 800 emails/week (was 560) — 43% increase, concentrated on business days

### Phase 53: Dedicated Demo Page & Explore Flow (2026-02-04)
- [x] **Dedicated Demo Page** - Created `/demo/index.html` as standalone demo experience
  - Full-page welcome screen with firm name, 3-step instructions, "Start Demo" button
  - Iframe container loads demo with `skip_onboarding=true` after user clicks "Start Demo"
  - Exit confirmation modal when navigating away mid-demo
  - "Explore PreIntake.ai website first" escape link with explore tracking
  - Uses shared `components.js` for header/footer
  - Header customizations: "Get Started →" button, "Demo" link removed (redundant)
  - `cleanFirmNameForDisplay()` strips ", Attorney at Law" suffixes
  - postMessage handling for `demo-started`, `intake-completed`, `demo-complete`, `demo-complete-redirect`
- [x] **Homepage Redirect** - `?demo=` on homepage now redirects to `/demo/` page
  - `checkCampaignDemo()` in `index.html` redirects to `/demo/?demo={id}&firm={name}`
  - Previous inline modal code kept but unreachable (reference only)
  - Separates demo experience from marketing homepage
- [x] **Explore Flow** - Navigation from demo page stores context and adds `?explore=1`
  - `handleNavClick()` in demo page:
    1. Stores `tbp_demo_id`, `tbp_demo_firm`, `tbp_demo_email` in sessionStorage
    2. Navigates with `?explore=1` flag appended to destination URL
    3. If demo started (not completed), shows exit confirmation first
  - `handleExploreFromDemo()` in homepage:
    1. Reads demo context from sessionStorage
    2. Shows welcome banner with firm name
    3. Hides demo request form and hero CTA (user already has a demo)
    4. Shows floating buttons ("Get Started" + "View Demo")
    5. Updates header button to "Get Started →"
    6. Cleans URL (removes `?explore=1`)
- [x] **components.js Updates** - Welcome banner and floating buttons for explore users
  - `renderWelcomeBanner()` - Shows "Welcome, {firmName}" on non-demo pages when `tbp_demo_id` in sessionStorage
  - `renderFloatingButtons()` - Shows "Get Started" + "View Demo" buttons on non-demo pages
  - Path-based exclusion: both functions skip rendering on `/demo/` paths
  - Header `renderHeader()` checks both `tbp_demo_viewed` and `tbp_demo_id` for "Get Started →" state
  - "Demo" nav link updated to "View Demo" pointing to `/demo/?demo={id}&firm={name}`
- [x] **Explore Tracking** - `trackDemoView?type=explore` tracked when user leaves demo to explore site
  - Tracked in `handleLeaveDemo()` (exit modal "Leave Anyway") and explore link on homepage
- [x] **Email Analytics Dashboard Cleanup** - Removed legacy stats grid and campaign detail sections
  - Simplified to focus on GA4 metrics and engagement funnel
- [x] **debug-flow.html** - Added diagnostic page for testing demo/explore flow

**Campaign Visitor Flow (Post-Refactor):**
```
Email click → homepage loads with ?demo= → REDIRECT to /demo/?demo={id}&firm={name}
  → Demo page loads → visit tracked
  → Welcome screen with firm name, 3 steps, "Start Demo" button
  → User clicks "Start Demo"
    → View tracked, sessionStorage updated
    → iframe loads with skip_onboarding=true
    → Demo conversation starts directly
  → OR User clicks header nav / "Explore" link
    → sessionStorage stores demo context (tbp_demo_id, tbp_demo_firm, tbp_demo_email)
    → Navigate to destination with ?explore=1
    → Destination page shows welcome banner + floating buttons from sessionStorage
```

**sessionStorage Keys (Demo Context):**
| Key | Set By | Purpose |
|-----|--------|---------|
| `tbp_demo_viewed` | Demo page (on "Start Demo" click) | Tracks that user started the demo |
| `tbp_demo_id` | Demo page (on navigation away) | Demo lead ID for "Get Started" / "View Demo" links |
| `tbp_demo_firm` | Demo page (on navigation away) | Firm name for welcome banner display |
| `tbp_demo_email` | Demo page (on navigation away) | Delivery email for exit modal |

**Banner Display Logic:**
| Visitor Type | Banner Display |
|--------------|----------------|
| `/demo/?demo=` (campaign visitor) | Demo page welcome screen with firm name |
| `?explore=1` (left demo to explore) | "Welcome, Smith & Associates" + floating buttons |
| `?completed=` (finished demo) | "Welcome, Smith & Associates" (no suffix/CTA) |
| `?firm=` (no demo yet) | "Welcome, Smith & Associates" (no suffix/CTA) |

### Phase 54: Demo Welcome Page Card Layout Fix (2026-02-08)
- [x] **Welcome Card Wrapper** - Fixed welcome page layout by adding missing `.demo-welcome` wrapper
  - Problem: Welcome page content (badge, firm name, steps, button) was spread out instead of contained in a card
  - Root cause: The `.demo-welcome` CSS class and wrapper div were removed in a previous refactor
  - Solution: Restored `.demo-welcome` CSS with card styling (max-width, border-radius, padding, box-shadow)
  - Wrapped all welcome content in `<div class="demo-welcome">` container
  - Responsive padding for mobile (2.5rem desktop, 1.75rem mobile)
- [x] **Iframe Content Fix** - Fixed iframe content visibility (reverted in earlier commit)
  - Changed `.demo-iframe-container` from `flex: 1` to explicit `height: calc(100vh - 72px)`
  - Changed `#landing-screen` in template from `overflow: hidden` + `justify-content: center` to `overflow-y: auto` + `justify-content: flex-start`
- [x] **Demo Regeneration** - All demos regenerated with updated template

### Phase 55: Demo URL Simplification & Path Detection Fix (2026-02-09)
- [x] **Firm Name from Database** - Simplified demo URLs to fetch firm name from database instead of URL params
  - Removed `&firm=` parameter from all demo URLs (emails, redirects, floating buttons)
  - `getPreIntakeFirmStatus` API now checks `data.firmName` (root level) first, then `data.analysis?.firmName`
  - Cleaner URLs: `/demo/?demo={leadId}` instead of `/demo/?demo={leadId}&firm={encoded_name}`
  - More reliable: firm name always comes from database, not potentially stale/truncated URL params
- [x] **Path Detection Fix** - Added `isOnDemoPage()` helper in `components.js`
  - Fixed issue where `/demo` (no trailing slash) didn't match `/demo/` check
  - Helper correctly matches `/demo`, `/demo/`, `/demo/index.html`, and `/demo/*` paths
  - Welcome banner and floating buttons now correctly hidden on demo page
- [x] **Badge Styling Update** - Demo page badge now matches homepage hero-badge
  - Pill shape (`border-radius: 50px`), gold border, transparent background, uppercase text
  - Consistent visual language across homepage and demo page
- [x] **New Utility Scripts**
  - `scripts/find-valid-demos.js` - Query Firestore for demos with valid firm names
  - `scripts/force-regen-demo.js` - Force regenerate a specific demo regardless of status

### Phase 56: Email Analytics Date Filter (2026-02-09)
- [x] **Data Cutoff Date** - Added February 9, 2026 cutoff to `getEmailAnalytics` Cloud Function
  - All email and lead data before this date is excluded from analytics
  - Constant `DATA_START_DATE = new Date('2026-02-09T00:00:00-08:00')` in `widget-functions.js`
  - Provides clean baseline for campaign performance measurement
- [x] **Application-Level Filtering** - Implemented in-memory filtering to avoid composite index requirements
  - `filterByDate()` helper filters `preintake_emails` by `sentTimestamp >= DATA_START_DATE`
  - Leads filtered by `createdAt >= DATA_START_DATE`
  - No Firestore composite indexes needed (avoids index creation delays)
- [x] **Affected Metrics** - All dashboard metrics now start from Feb 9, 2026:
  - Email stats: totalSent, withDemo, withoutDemo, templateVersions
  - Lead stats: campaignLeads, visitedCount, viewedCount, intakeCompletedCount
  - Source/state breakdowns filtered accordingly

### Phase 57: Auto-Load Demo & Analytics Simplification (2026-02-09)
- [x] **Auto-Load Demo on Page Visit** - Removed "Start Demo" button friction
  - Problem: Email CTA says "View Your Firm's Demo" but users landed on welcome page requiring another click
  - Result: High visits but virtually no demo starts (users bounced at welcome page)
  - Solution: Demo now auto-loads immediately when page loads
  - Removed welcome screen content (badge, 3-step instructions, Start Demo button)
  - Added minimal firm name banner above demo iframe
  - Track both `visit` and `view` on page load (merged since demo auto-loads)
  - Simplified CSS and JS for streamlined UX
- [x] **Analytics Dashboard Update** - Merged visit/view metrics since they're now equivalent
  - Updated engagement funnel: Sent → Demo Viewed → Explored → Completed (4 steps, was 5)
  - Removed redundant "Demo Start Rate" from Key Rates (would always be ~100%)
  - Renamed columns: "Clicked" → "Demo Viewed", added "Completion Rate"
  - Removed "Demo Starts" column from Template Performance table
  - Removed "Demo Starts" column from Source Performance table
  - Removed "Demo Starts" column from Lead Details table
  - Consistent terminology across all dashboard sections

**Updated Campaign Visitor Flow (Phase 57 - superseded by Phase 74):**
```
NOTE: Phase 57 implemented auto-load demo on page visit.
Phase 74 replaced this with Preview Mode (sample report shown first).
See Phase 74 for current architecture.
```

**Current Tracking Flow (as of Phase 74):**
1. `trackDemoView?type=visit` - On `/demo/` page load (sample report displayed)
2. `trackDemoView?type=view` - On "Start Demo" CTA click (iframe loads)
3. `trackDemoView?type=explore` - When user leaves demo to explore site
4. `intakeDelivery.success` - When intake report is sent to firm's email

### Phase 58: firmName Data Quality Cleanup (2026-02-10)
- [x] **Kentucky Bar firmName Fix** - Scraper was storing "Official Address Information" placeholder text
  - Fixed `scripts/scrape-kybar-attorneys.js` to skip placeholder text and PO Box patterns
  - Cleaned 5,894 existing records (set firmName to empty string)
- [x] **NC Bar firmName Fix** - Scraper was concatenating firm name + address
  - Fixed `scripts/scrape-ncbar-attorneys.js` to skip PO Box addresses in firm name extraction
  - Created `functions/fix-ncbar-firmnames.js` with regex patterns to extract firm names from concatenated strings
  - Cleaned 590 records with concatenated addresses (legal suffixes + street numbers, PO Box patterns)
- [x] **FL Bar firmName Fix** - Some records had standalone PO Box as firm name
  - Fixed `scripts/scrape-flbar-attorneys.js` `cleanFirmName()` to reject PO Box entries
  - Cleaned 26 records
- [x] **General firmName Cleanup** - Created comprehensive audit and fix scripts
  - Created `functions/fix-firmname-issues.js` for clear errors (N/A, emails, URLs, phone numbers, addresses)
  - Fixed 35 additional records across various sources
- [x] **Comprehensive Audit** - Audited all firmName fields for data quality issues
  - Audit checks: startsWithNumber, containsZipCode, tooShort, justNumbers, containsSuite, containsStateAbbr, allCaps, containsAtSymbol, containsUrl, trailingPunctuation, containsPhonePattern, suffixThenNumber, startsLowercase, containsBrTag
  - Remaining issues are mostly false positives (legal suffixes like PA, PC, LLP flagged near address numbers)

**Total Records Cleaned: ~6,545**
| Source | Records | Issue |
|--------|---------|-------|
| Kentucky Bar | 5,894 | "Official Address Information" placeholder |
| NC Bar | 590 | Concatenated firm name + address |
| FL Bar | 26 | PO Box in firm name |
| Various | 35 | N/A, emails, URLs, phone numbers |

**Utility Scripts Created:**
| Script | Purpose |
|--------|---------|
| `functions/fix-firmname-issues.js` | Fix clear errors (N/A, emails, URLs, phone numbers, addresses) |
| `functions/fix-ncbar-firmnames.js` | Extract firm names from NC Bar concatenated address strings |

### Phase 59: Conditional Header & Demo Notice Banner (2026-02-10)
- [x] **Conditional Header Display** - White-label experience for paid subscribers
  - Header hidden when `subscriptionStatus === 'active'` (paid subscribers)
  - Header shown for `demo_ready` status OR Stephen's test account (`deliveryEmail === 'stephen@teambuildpro.com'`)
  - Parent page (`/demo/index.html`) fetches status via `getPreIntakeFirmStatus` API
  - Uses `--header-h` CSS variable to adjust iframe height when header hidden
- [x] **Demo Notice Banner** - Contextual messaging for demo users
  - Banner displayed via postMessage from parent to iframe
  - Website users: "Activate to get an embed code—your clients complete intakes directly on your website"
  - Hosted users: "Activate to get a shareable link for emails, social media, or anywhere you connect with clients"
  - Gold accent styling matching brand (rgba(201, 169, 98, 0.15) background)
- [x] **Button Text Updates** - Consistent "Create Account" terminology
  - Changed "Get Started" → "Create Account" across demo template and parent pages
  - Changed "Start My Evaluation" → "Start My Review" on landing screen CTA
  - Changed "Evaluation Progress" → "Case Review Progress" in sidebar
- [x] **Demo Regeneration** - All 1,517 demos regenerated with updated template
  - Used fast gsutil patch method for simple text changes (~3 min vs ~45 min)

**Files Modified:**
| File | Changes |
|------|---------|
| `/preintake/demo/index.html` | Header hiding logic, postMessage to iframe |
| `/functions/templates/demo-intake.html.template` | Demo notice HTML/CSS, button text changes |
| `/preintake/js/components.js` | Button label updates |
| `/preintake/index.html` | CTA button text updates |

### Phase 60: SEO Audit & Optimization (2026-02-11)
- [x] **Meta Tag Optimization** - Fixed truncation issues in Google SERPs
  - About Us: Shortened title (65→56 chars), description (182→143 chars)
  - FAQ: Shortened title (70→55 chars), description (186→154 chars)
- [x] **Open Graph Images** - Added missing og:image to legal pages
  - Privacy Policy: Added `og:image` pointing to `/images/og-image.png`
  - Terms of Service: Added `og:image` pointing to `/images/og-image.png`
- [x] **Twitter Card Tags** - Added to all pages for social sharing
  - About Us, FAQ, Privacy Policy, Terms of Service all now have full Twitter Card meta tags
  - Uses `summary_large_image` card type with consistent branding
- [x] **Sitemap Update** - Updated all lastmod dates to 2026-02-11
- [x] **Organization Schema** - Added to About Us page with contact point and service info
- [x] **Contact Page H1** - Changed from "Get In Touch" to "Contact PreIntake.ai"
- [x] **Contact Page Twitter Cards** - Added missing Twitter Card tags
- [x] **Internal Linking** - Added cross-links between pages:
  - About Us → FAQ (in "Our Approach" section)
  - About Us → Contact (in "Mission" section)
  - FAQ → Contact (in CRM integration answer and CTA section)
  - Contact → About Us (in contact info section)

**SEO Audit Summary (Score: 7.5/10):**
| Strength | Status |
|----------|--------|
| Proper noindex on utility pages | ✅ |
| SoftwareApplication + FAQPage schema | ✅ |
| Clean URL structure | ✅ |
| Consistent canonical URLs | ✅ |

| Opportunity | Priority |
|-------------|----------|
| Practice-specific keyword targeting | Medium |
| Comparison/ROI content pages | Low |
| Internal linking strategy | Medium |

**Files Modified:**
| File | Changes |
|------|---------|
| `about-us.html` | Shortened title/description, added Twitter Cards |
| `faq.html` | Shortened title/description, added Twitter Cards |
| `privacy-policy.html` | Added og:image, Twitter Cards |
| `terms-of-service.html` | Added og:image, Twitter Cards |
| `sitemap.xml` | Updated lastmod dates |

### Phase 61: GSC Indexing Fix (2026-02-15)
- [x] **GSC Investigation** - Analyzed Google Search Console export showing 3 critical issues:
  - 1x "Not found (404)" - URLs without .html hitting catch-all rewrite
  - 1x "Page with redirect" - Same root cause
  - 1x "Alternate page with proper canonical" - Expected behavior (index.html → /)
- [x] **Root Cause** - `preintake-ai` Firebase hosting had empty `redirects` array
  - Clean URLs like `/faq` fell through to `/:intakeCode` catch-all rewrite
  - `serveHostedIntake` function returned 400/404 for non-intake-code paths
- [x] **Fix Applied** - Added 10 redirect rules to `firebase.json`:
  - `/faq` → `/faq.html`, `/faqs` → `/faq.html`
  - `/about-us` → `/about-us.html`, `/about` → `/about-us.html`
  - `/contact-us` → `/contact-us.html`, `/contact` → `/contact-us.html`
  - `/privacy-policy` → `/privacy-policy.html`, `/privacy` → `/privacy-policy.html`
  - `/terms-of-service` → `/terms-of-service.html`, `/terms` → `/terms-of-service.html`
- [x] **Deployment** - Deployed hosting config, verified 301 redirects working

**Current Indexing Status:**
- Indexed: 2 pages (of 6 in sitemap)
- Not indexed: 3 pages (should resolve after Google re-crawls)

### Phase 62: Demo Notice Text Optimization (2026-02-15)
- [x] **Problem Analysis** - 23 demo views with 0 intake completions (0% completion rate)
  - Users open demo but abandon before completing the intake conversation
  - Old demo notice focused on "Create Account" instead of demo value
  - No time estimate or clear outcome communicated
- [x] **Demo Notice Text Rewrite** - Changed from account-focused to value-focused messaging
  - **Old text**: "Demo Mode: This intake is customized for your firm. Create Account to get an embed code..."
  - **New text**: "Try It Now (~2 min): Complete this intake demo to receive a full case screening report at **{email}**. See exactly what your team receives for every inquiry."
- [x] **Key Improvements**:
  - Added time estimate ("~2 min") to set expectations
  - Shows delivery email dynamically (personalized)
  - Action-oriented CTA ("Try It Now" vs "Demo Mode")
  - Clear value proposition ("full case screening report")
  - Removed account creation push (save for post-completion)
- [x] **Fast Demo Patch** - Used gsutil parallel operations
  - Patched 2,710 of 2,827 demos in ~7 minutes
  - Template updated for future demos

**Files Modified:**
| File | Changes |
|------|---------|
| `/functions/templates/demo-intake.html.template` | Demo notice text rewrite |

### Phase 63: AI Strategic Insights Dashboard (2026-02-15)
- [x] **Claude AI Integration** - Added AI-powered strategic insights to campaign analytics
  - Uses Claude Sonnet 4 (`claude-sonnet-4-20250514`) for analysis
  - Generates insights based on funnel metrics, source performance, and template effectiveness
- [x] **Backend Implementation** - `functions/widget-functions.js`
  - Added `generatePreIntakeInsights()` function with PreIntake.ai-specific context
  - Updated `getEmailAnalytics` endpoint to include `secrets: [anthropicApiKey]`
  - Returns structured JSON with `whatsWorking`, `needsAttention`, `recommendedActions`
- [x] **Frontend Implementation** - `preintake/preintake-analytics.html`
  - Added Strategic Insights section at top of dashboard
  - Three-column grid layout with color-coded cards:
    - **What's Working** (green) - high-performing elements
    - **Needs Attention** (amber) - issues requiring focus
    - **Recommended Actions** (blue) - specific next steps
  - Each insight shows metric context and impact/severity/priority badges
- [x] **Context-Aware Recommendations** - Added "RECENTLY IMPLEMENTED" section to AI prompt
  - Lists completed implementations (auto-load demo, demo notice text, firmName cleanup, SEO, GSC, etc.)
  - Prevents AI from recommending actions already completed
  - Ensures actionable, relevant recommendations only

**Insights Generated:**
- Source performance comparison (which bar associations convert best)
- Template effectiveness (v6-personalized vs v7-bar-profile)
- Funnel bottleneck identification (demo view → completion)
- Email list health analysis (unsubscribe/failure rates)
- Actionable recommendations with expected impact

**Files Modified:**
| File | Changes |
|------|---------|
| `functions/widget-functions.js` | Added `generatePreIntakeInsights()`, updated `getEmailAnalytics` with secrets |
| `preintake/preintake-analytics.html` | Added Strategic Insights section with CSS and rendering code |

### Phase 64: In-Demo Milestone Tracking (2026-02-15)
- [x] **Problem Analysis** - 23 demo views with 0 completions, no visibility into conversation progress
  - Existing tracking: `visit` (page load), `view` (demo start), `explore` (left to browse), `intakeDelivery.success` (completed)
  - Gap: No visibility into what happens INSIDE the demo conversation
  - Result: Cannot identify where users abandon the intake flow
- [x] **3 New Milestones** - Granular tracking without over-instrumentation
  - `conversation_started` - First user message sent (user engaged with chat)
  - `contact_collected` - `collect_contact_info` tool fires (user provided name/phone/email)
  - `screening_started` - `collect_case_info` tool fires (user started practice-area questions)
- [x] **Backend Implementation** - `functions/widget-functions.js`
  - Extended `trackDemoView` endpoint to accept 3 new milestone types
  - Validates type is one of: `visit`, `view`, `explore`, `conversation_started`, `contact_collected`, `screening_started`
  - Updates Firestore with `{type}At` timestamp field for each milestone
  - Extended `getEmailAnalytics` to count milestone occurrences across all leads
- [x] **Template Implementation** - `functions/templates/demo-intake.html.template`
  - Added `trackMilestone()` helper function with deduplication
  - **Key feature**: Skips tracking for active subscribers (`subscriptionStatus === 'active'`)
  - Tracking calls at 3 trigger points:
    - In `sendMessage()` after first user message → `conversation_started`
    - In `processToolUse()` case `collect_contact_info` → `contact_collected`
    - In `processToolUse()` case `collect_case_info` → `screening_started`
- [x] **Dashboard Update** - `preintake/preintake-analytics.html`
  - Changed funnel from 4 steps to 6 steps with milestones:
    - Emails Sent → Demo Viewed → Started Chat → Contact Given → Screening → Completed
  - Added milestone columns to Lead Details table with checkmark indicators
  - Adjusted CSS for 6-step funnel layout (reduced min-width, font sizes)
- [x] **Bulk Demo Patch** - gsutil parallel operations
  - Initial patch: 2,827 demos with milestone tracking code
  - v2 patch: Added active subscriber check to skip tracking for paid users
  - Final result: All demos updated with conditional milestone tracking

**Resulting Funnel:**
```
Emails Sent → Demo Viewed → Conversation Started → Contact Collected → Screening Started → Completed
```

**Files Modified:**
| File | Changes |
|------|---------|
| `functions/widget-functions.js` | Extended `trackDemoView` types, updated `getEmailAnalytics` with milestone counts |
| `functions/templates/demo-intake.html.template` | Added `trackMilestone()` helper and 3 trigger points |
| `preintake/preintake-analytics.html` | 6-step funnel visualization, milestone columns in Lead Details |

### Phase 65: Demo Banner Redesign & SMTP Fix (2026-02-16)
- [x] **Demo Notice Banner Redesign** - Enhanced banner with firm-specific personalization
  - Old banner: Static text "Try It Now (~2 min): Complete this intake demo..."
  - New banner: 2-part structure with headline and body (CTA removed)
  - Headline: "✨ Your Customized Demo for **{firmName}**"
  - Body: "Complete this intake demo in **~2-3 minutes** to receive a full case review report..."
  - CSS: Updated `.demo-notice` with improved styling, added `.demo-notice-headline`, `.demo-notice-body` classes
  - HTML: Changed from single `<p>` to structured `<div>` elements
  - JS: Dynamic content population from `firmStatus` object
- [x] **CTA Line Removal** - Simplified banner by removing conditional CTA
  - Removed `hasWebsite` conditional logic that showed embed/hosted messaging
  - Removed `.demo-notice-cta` CSS class and HTML element
  - Banner now shows only headline + body (cleaner UX)
- [x] **Bulk Demo Patch** - gsutil parallel operations
  - Initial patch: 2,759 demos with banner redesign
  - Second patch: 2,760 demos with CTA removal + text fix ("Personalized" → "Customized")
- [x] **SMTP Authentication Fix** - Demo confirmation emails
  - Issue: SMTP authentication failure (`535 5.7.8 Error: authentication failed`)
  - Root cause: Dreamhost password for `stephen@law.preintake.ai` didn't match Firebase/GCP secrets
  - Fix: User updated Dreamhost password to match secret value
  - Verified: SMTP working, demo email sent successfully
- [x] **Environment File Note** - SMTP credentials managed via Firebase Secrets
  - `PREINTAKE_SMTP_USER` and `PREINTAKE_SMTP_PASS` use `defineSecret()` in Cloud Functions
  - Cannot be added to `.env` file (conflicts with secret environment variables)
  - Credentials documented as comments in `.env.teambuilder-plus-fe74d`

**Test Account:**
- Lead ID: `3vhfvzks9EHCRkgyKLU4` (scscot@gmail.com)
- Use this lead for testing demo functionality going forward

**Files Modified:**
| File | Changes |
|------|---------|
| `functions/templates/demo-intake.html.template` | Banner CSS, HTML structure, JS logic (CTA removed) |

### Phase 66: Proportional Contact Selection Fix (2026-02-16)
- [x] **Analytics Dashboard Fix** - Removed DATA_START_DATE filter
  - Issue: Campaign Lead Details showed NO checkmarks under WEBSITE column for any leads
  - Root cause: `DATA_START_DATE` filter (Feb 9, 2026) in `widget-functions.js` excluded 23 of 24 website leads
  - Fix: Removed `DATA_START_DATE` constant and `filterByDate()` function
  - Deployed via `firebase deploy --only functions:getEmailAnalytics`
- [x] **Campaign Script Fix** - Proportional selection for contact types
  - Issue: Email campaign was sending 12:1 bar profile vs website contacts
  - Root cause: Firestore inequality query on `website != ''` requires `orderBy('website')` before `orderBy('randomIndex')`
  - This caused website contacts to be fetched in alphabetical order by URL, not by randomIndex
  - When merged with bar profile contacts (sorted by randomIndex), bar profiles dominated
  - Fix: Implemented proportional selection in `send-preintake-campaign.js`:
    - Sort website contacts by randomIndex after fetching (client-side sort)
    - Take ~50% from website pool and ~50% from bar profile pool
    - Merge and sort by randomIndex for final processing order
  - Test result: 25 website + 25 bar profile = perfect 50/50 split per batch
- [x] **Diagnostic Scripts Created** (for investigation, can be deleted)
  - `functions/check-leads.js` - Checks leads with visits and hasWebsite status
  - `functions/check-email-queue.js` - Email queue status by contact type
  - `functions/check-random-index.js` - RandomIndex distribution analysis
  - `functions/check-website-fields.js` - Field pattern analysis

**Files Modified:**
| File | Changes |
|------|---------|
| `functions/widget-functions.js` | Removed DATA_START_DATE filter from getEmailAnalytics |
| `scripts/send-preintake-campaign.js` | Proportional selection (50/50 website vs bar profile) |

### Phase 67: V8 Bar Profile Email Template (2026-02-16)
- [x] **Template Revision** - Adopted V6's problem-focused messaging approach for bar profile emails
  - V6 (Website Demo) had 11.3% view rate vs V7's 2.1% - a 5x performance difference
  - Root cause: V7's personal "I came across your Bar profile" approach felt intrusive/sales-y
  - Solution: Use V6's problem-focused opening, move "no website needed" to trust signals section
- [x] **Subject Line Update** - Changed to match V6's successful pattern
  - Old: "I built you a personalized intake demo"
  - New: "Pre-screen every inquiry before it reaches you"
- [x] **HTML Template Rewrite** - `generateBarProfileEmailHTML()` function
  - New preheader with firm name personalization
  - Changed greeting from "Hi" to "Hello" for consistency with V6
  - Opening paragraph: Problem statement about intake signal-to-noise ratio
  - Value prop: Focus on prioritization and efficiency
  - Features: Bulleted list with bolded qualification ratings
  - Trust signals: "Zero Data Retention" with gold accent, then hosted intake explanation
  - CTA: "View Your Customized Demo" (changed from "See Your Personalized Demo →")
  - Closing: "No commitment. Review it on your own — no calls required."
- [x] **Plain Text Version Update** - `generateBarProfileEmailPlainText()` mirrored changes
- [x] **Template Version Update** - Changed from `v7-bar-profile-demo` to `v8-bar-profile-demo`
  - Enables A/B performance comparison in analytics dashboard
  - Historical v7 data preserved for benchmarking

**Key Messaging Changes:**
| Element | V7 (Old) | V8 (New) |
|---------|----------|----------|
| Subject | "I built you a personalized intake demo" | "Pre-screen every inquiry before it reaches you" |
| Opening | "I came across your Bar profile..." | Problem statement (same as V6) |
| Tone | Personal/sales-y | Problem-focused/professional |
| No-website message | Opening paragraph | Trust signal section (less prominent) |
| CTA | "See Your Personalized Demo →" | "View Your Customized Demo" |

**Removed Elements:**
- ❌ "I came across your {state} Bar profile and saw that you handle {practiceArea} matters"
- ❌ "Based on public Bar information, I put together a short demo..."
- ❌ "It takes about two minutes to review. No setup. No commitment."
- ❌ "If it saves you a few interruptions a week, it's doing its job."

**Files Modified:**
| File | Changes |
|------|---------|
| `scripts/send-preintake-campaign.js` | Subject line, HTML template, plain text template, template version |

**Success Metrics:**
- Target: Increase bar profile view rate from 2.1% toward V6's 11.3%
- Tracking: Compare `v8-bar-profile-demo` vs `v7-bar-profile-demo` in Template Performance table

### Phase 68: SPF Fix for law.preintake.ai (2026-02-17)
- [x] **SPF Softfail Diagnosis** - Test emails landing in spam despite DKIM/DMARC passing
  - Root cause: SPF record for `law.preintake.ai` was missing Mailgun authorization
  - Old SPF: `v=spf1 include:relay.mailchannels.net include:netblocks.dreamhost.com ~all`
  - Gmail returned: `spf=softfail (domain does not designate 143.55.232.47 as permitted sender)`
- [x] **SPF Record Updated** - Added Mailgun to authorized senders
  - New SPF: `v=spf1 include:mailgun.org include:relay.mailchannels.net include:netblocks.dreamhost.com ~all`
  - All three checks now passing: SPF ✅, DKIM ✅, DMARC ✅
- [x] **Test Email Verification** - Confirmed emails now land in inbox
  - Created test contact in `preintake_emails` for proper deliverability testing
  - To header mismatch (firm name vs personal email) can also trigger spam filters

**DNS Change:**
- Record Type: TXT
- Host: `law.preintake.ai`
- Value: `v=spf1 include:mailgun.org include:relay.mailchannels.net include:netblocks.dreamhost.com ~all`

### Phase 69: Analytics Dashboard v8 Support (2026-02-17)
- [x] **Template Mapping Update** - Added v8 to `formatTemplate()` function
  - Added `'v8-bar-profile-demo': 'Bar Profile (v8)'` to template mapping
  - Dashboard now correctly displays V8 template in Template Performance table

**Files Modified:**
| File | Changes |
|------|---------|
| `preintake/preintake-analytics.html` | Added v8 template mapping to `formatTemplate()` |

### Phase 70: Remove Yahoo/AOL Exclusion (2026-02-19)
- [x] **Domain Warming Complete** - Removed Yahoo/AOL email exclusion from campaign
  - Domain warming period has matured sufficiently
  - Email campaign now sends to all providers including Yahoo, AOL, and free email services
  - Removed `EXCLUDE_YAHOO_AOL: 'true'` environment variable from workflow
- [x] **Root Cause Analysis** - Investigated why 2:30pm batch sent 0 emails
  - Yahoo/AOL exclusion was filtering contacts AFTER proportional selection
  - When all 50 selected contacts were Yahoo/AOL, post-selection filtering resulted in 0 sends
  - Fix: Remove exclusion entirely rather than move filtering before selection

**Files Modified:**
| File | Changes |
|------|---------|
| `.github/workflows/preintake-email-campaign.yml` | Removed `EXCLUDE_YAHOO_AOL` env var and related logging |

### Phase 71: Haiku 4.5 Model & Cleanup Optimization (2026-02-20)
- [x] **Claude Haiku 4.5 Migration** - Switched primary AI model for faster demo conversations
  - Changed model from Claude Sonnet to Claude Haiku 4.5 (`claude-haiku-4-5`) in `widget-functions.js`
  - Performance improvement: 1-3s response time (was 20-40s with Sonnet) - ~15x faster
  - Cost savings: Haiku 4.5 is significantly cheaper per token
  - Quality maintained: Haiku 4.5 is near-frontier intelligence for conversation tasks
- [x] **Demo Cleanup Optimization** - Reduced cutoff from 31 days to 15 days
  - Modified `scripts/cleanup-stale-demos.js` to delete demos 15+ days old (was 31)
  - Added access-based deletion criteria (only delete demos NEVER accessed via email CTA)
  - New skip criteria: `firstVisitAt` set OR `visitCount > 0` → demo is preserved
  - Demos that were clicked on from emails are retained even if unconverted
- [x] **Protected Accounts List** - Added test account protection
  - Protected IDs: `3vhfvzks9EHCRkgyKLU4` (Claery & Hammond test), `9yXCw3SXVjBeHJTbD4qr` (Scott Law Group paid test)
  - Protected accounts never deleted regardless of age
  - Added `skippedProtected` counter in cleanup summary
- [x] **Demo Regeneration** - All demos regenerated with Haiku 4.5 model
  - 3,267 demo_ready leads regenerated with updated template
  - Ensures all demos use the faster Haiku 4.5 model

**Cleanup Deletion Criteria (updated):**
```
Demo is deleted if ALL conditions are true:
1. demo.generatedAt >= 15 days ago
2. No stripeSubscriptionId (never converted to paid)
3. Not in PROTECTED_LEAD_IDS list
4. No firstVisitAt AND visitCount == 0 (never accessed via email)
```

**Files Modified:**
| File | Changes |
|------|---------|
| `functions/widget-functions.js` | Changed model to `claude-haiku-4-5` |
| `scripts/cleanup-stale-demos.js` | 15-day cutoff, access-based deletion, protected accounts |

### Phase 72: Analytics Benchmark Reset (2026-02-20)
- [x] **Analytics Dashboard Rename** - Renamed for clarity
  - Changed `email-analytics.html` → `preintake-analytics.html`
  - Better reflects full dashboard scope (GA4 + email + engagement metrics)
- [x] **Analytics Benchmark Date** - Established Feb 20, 2026 as clean baseline
  - Added `ANALYTICS_BENCHMARK_DATE` constant to `widget-functions.js`
  - All email and lead data before this date is excluded from analytics
  - Filters applied in-memory to avoid Firestore composite index requirements
  - Response now includes `benchmarkDate` field for dashboard display
- [x] **Metrics Reset Logic** - Clean baseline for conversion tracking
  - `totalSent` = emails sent on/after Feb 20, 2026 (starting from 0)
  - `totalContacts` = pending pool (remaining unsent contacts)
  - Lead engagement metrics (visited, viewed, completed) filtered by benchmark date
- [x] **Updated CLAUDE.md** - All references updated to new filename

**Rationale:** After implementing demo conversation fixes (Haiku 4.5 model, button detection improvements), establishing a clean analytics baseline allows accurate measurement of improved conversion rates without historical data from buggy period skewing metrics.

**Files Modified:**
| File | Changes |
|------|---------|
| `preintake/email-analytics.html` | Renamed to `preintake-analytics.html` |
| `functions/widget-functions.js` | Added `ANALYTICS_BENCHMARK_DATE`, filtered queries |
| `preintake/CLAUDE.md` | Updated all filename references |

### Phase 73: Dynamic Demo Architecture & Scheduled Cleanup (2026-02-21)
- [x] **Dynamic Demo Architecture Complete** - Migrated from static files to dynamic serving
  - Single master template (`/preintake/intake.html`) served dynamically
  - Firm-specific data fetched via `getWidgetConfig` API at runtime
  - `serveDemo()` redirects to `/intake.html?demo={leadId}`
  - Eliminates need for 3,400+ static HTML files in Storage (~680MB)
- [x] **Scheduled Cleanup Workflow** - `.github/workflows/cleanup-preintake-storage.yml`
  - Scheduled for March 1, 2026 at 6am PT (14:00 UTC)
  - Year check prevents recurring execution (only runs in 2026)
  - Manual trigger available via `workflow_dispatch`
  - **Storage cleanup**: Deletes all static demo files from `gs://teambuilder-plus-fe74d.firebasestorage.app/preintake-demos/`
  - **Script cleanup**: Deletes 5 regeneration scripts no longer needed:
    - `scripts/force-regen-demo.js`
    - `scripts/regenerate-bar-profile-demos.js`
    - `scripts/regenerate-demo.js`
    - `scripts/regenerate-preintake-demos.js`
    - `scripts/update-demo-postmessage.js`
  - Auto-commits and pushes script deletions

**Benefits After Migration:**
| Before | After |
|--------|-------|
| 3,400+ static files | 1 master template |
| ~680MB Storage usage | ~200KB |
| Bulk patching for updates | Instant deploys |
| 45+ min regeneration | Zero regeneration |
| gsutil scripts needed | Standard deploy workflow |

**Files Created:**
| File | Purpose |
|------|---------|
| `.github/workflows/cleanup-preintake-storage.yml` | Scheduled cleanup for March 1, 2026 |

### Phase 74: Preview Mode - Sample Report Before Demo (2026-02-21)
- [x] **Problem Analysis** - 23 demo views with 0 completions (0% completion rate)
  - Root cause: Users asked to invest time before seeing any value
  - Demo auto-loaded immediately but users abandoned before engaging
  - No preview of what they would receive for completing the demo
- [x] **Preview Mode Implementation** - Show OUTPUT before asking for INPUT
  - Demo page now displays sample intake report card first (iframe deferred)
  - Sample report shows realistic Personal Injury case assessment:
    - GREEN "QUALIFIED — High Confidence" badge
    - Contact name visible (Sarah Mitchell - matches transcript)
    - Case summary narrative
    - 4 positive factors (checkmarks), 1 concern (warning)
    - Recommended action
  - Firm name personalized from database
  - "Start Demo" CTA button loads iframe only when clicked
- [x] **Collapsible Conversation Transcript** - Full conversation supporting the report
  - "View Full Conversation Transcript" toggle link after Recommended Action
  - Expands to reveal complete PI intake conversation (15 exchanges)
  - Conversation matches all report data points:
    - Rear-ended at stoplight, 3 weeks ago
    - Neck pain, seeing chiropractor
    - Police report filed, other driver cited
    - Photos of vehicle damage
    - Pre-existing back condition mentioned
  - Styling matches intake email format (Visitor/Intake speaker labels)
  - Smooth CSS expand/collapse animation with rotating chevron
- [x] **Tracking Flow Update** - Separated visit and view events
  - `visit` tracked on page load (user saw sample report)
  - `view` tracked on CTA click (user engaged with demo)
  - Enables measurement of sample report → demo start conversion
- [x] **CSS/JS Updates** - `/preintake/demo/index.html`
  - Added ~260 lines of preview mode CSS (`.preview-container`, `.sample-report`, `.transcript-*`, etc.)
  - Iframe container hidden by default, shown on CTA click
  - JavaScript refactored: `init()` shows preview, `startDemo()` loads iframe
  - Transcript toggle handled via `setupEventListeners()`

**New Campaign Visitor Flow:**
```
Email click → homepage (?demo=) → REDIRECT to /demo/?demo={id}
  → Demo page loads → visit tracked → Sample report card displayed
  → User sees what they'll receive (qualification badge, factors, summary)
  → User can expand transcript to see full conversation
  → User clicks "Start Demo" CTA
    → view tracked → iframe loads with skip_onboarding=true
    → Demo conversation starts
  → OR User explores site first → explore flow unchanged
```

**Files Modified:**
| File | Changes |
|------|---------|
| `/preintake/demo/index.html` | Preview mode HTML, CSS, JS; deferred iframe loading; conversation transcript |

### Phase 75: Stripe Renewal Email Disabled (2026-02-21)
- [x] **Stripe Dashboard Setting** - Disabled "Send emails about upcoming renewals"
  - Stripe was sending automatic renewal reminder emails 7 days before billing
  - These emails are unnecessary for auto-renewing subscriptions
  - Setting location: Stripe Dashboard → Settings → Emails → Customer emails
  - No code changes required - this is a Stripe Dashboard configuration

### Phase 76: Demo Header Simplification (2026-02-21)
- [x] **Simplified intake.html Header** - Reduced nav menu to focus on conversion
  - Removed: Pricing, About, FAQs, Contact links
  - Kept: Home, Create Account button
  - Rationale: Demo is a critical conversion point; fewer nav options reduces distraction
  - Users who want to explore go to Homepage first, where full navigation is available
- [x] **Fixed "My Account" Button Issue** - Header was showing wrong button text on initial load
  - Problem: `components.js` was overwriting the inline header because it matched `id="preintake-header"`
  - Solution: Changed header id from `preintake-header` to `intake-header` in 3 places:
    - CSS selector (line 49): `body.embed-mode #intake-header`
    - HTML element (line 1569): `<header class="intake-header" id="intake-header">`
    - JavaScript (line 3131): `document.getElementById('intake-header')`
  - Result: Header now correctly shows "Create Account" on initial page load

**UX Design Decision:**
- Demo page has minimal navigation (Home + Create Account) to focus on conversion
- Homepage serves as the hub for users who want to explore the full offering
- This follows conversion funnel best practices: reduce distractions at critical conversion points

### Phase 77: Analytics Benchmark Reset to Feb 24, 2026 (2026-02-24)
- [x] **Fresh Analytics Start** - Reset benchmark date for clean metrics
  - Changed `ANALYTICS_BENCHMARK_DATE` from `2026-02-21` to `2026-02-24`
  - All email campaign and lead engagement data now filtered from Feb 24 forward
  - Previous 28 leads with visits excluded from dashboard
- [x] **FirmName Extraction Fix** - Improved email campaign data quality
  - Added `isValidFirmName()` function with 11 junk pattern detections
  - Changed firmName priority: prefer original bar data over scraped page titles
  - Prevents junk names like "Home - Jeff McNamara Law" from appearing in analytics

**Rationale:** Starting fresh after fixing firmName extraction logic and establishing clean baseline for accurate conversion tracking.

**Files Modified:**
| File | Changes |
|------|---------|
| `functions/widget-functions.js` | Updated `ANALYTICS_BENCHMARK_DATE` to `2026-02-24` |
| `scripts/send-preintake-campaign.js` | Added `isValidFirmName()`, changed firmName priority logic |

### Phase 78: Demo Elimination - Direct Landing Page Conversion (2026-02-24)
- [x] **Strategic Pivot** - Eliminated demo requirement for conversion
  - After 15+ demo flow iterations with 0% completion rate, removed demo as conversion bottleneck
  - Email campaigns now link directly to landing page with personalized CTAs
  - Users convert via landing page → create-account → Stripe checkout
- [x] **Email Campaign Simplification** - Removed inline demo generation
  - `scripts/send-preintake-campaign.js` no longer generates demos before sending
  - Creates minimal lead documents for tracking and personalization
  - Removed `ANTHROPIC_API_KEY` dependency from campaign script
  - Simplified from ~500 lines to ~300 lines
- [x] **URL Parameter Standardization** - Changed `?firm=` to `?lead=`
  - All create-account URLs now use `?lead={leadId}` parameter
  - Backward compatibility maintained for `?demo=` parameter on landing page
  - Updated: `index.html`, `create-account.html`, `components.js`, `intake.html`
- [x] **Landing Page Campaign Flow** - Personalized experience for email recipients
  - `?lead=` parameter triggers personalized welcome banner
  - Shows firm name, floating CTAs ("Get Started", "View Demo")
  - Direct path to account creation without demo requirement
  - Demo still available via "View Demo" button for interested users
- [x] **Stripe API Key Refresh** - Updated Secret Manager with new key
  - Resolved `StripeConnectionError` caused by key mismatch
  - Secret Manager `STRIPE_SECRET_KEY` updated to version 5
- [x] **Stripe Link Decision** - Kept enabled after analysis
  - Link provides faster checkout for users who have it
  - Standard card payment still available for all users
  - Dashboard toggle available if issues arise

**New Campaign Visitor Flow:**
```
Email click → Landing page (?lead=) → Welcome banner + floating CTAs
  → "Get Started" → /create-account.html?lead={id} → Stripe checkout
  → OR "View Demo" → /demo/?demo={id} (optional, for interested users)
```

**Rationale:** The demo asked users to CREATE value rather than SHOWING them value. After analyzing 15+ iterations with 0% completion, removing the demo requirement and converting directly via landing page eliminates the bottleneck.

**Files Modified:**
| File | Changes |
|------|---------|
| `scripts/send-preintake-campaign.js` | Removed demo generation, simplified to lead creation |
| `preintake/index.html` | Updated campaign flow, `?lead=` parameter handling |
| `preintake/create-account.html` | Changed `?firm=` to `?lead=` parameter |
| `preintake/js/components.js` | Updated create-account URL parameter |
| `preintake/intake.html` | Updated create-account URL parameter |
| `preintake/demo/index.html` | Updated create-account URL parameter |

### Phase 79: Email Template Refinements (2026-02-24)
- [x] **CTA Button Label Change** - Changed from "Get Started" to "Learn More"
  - Softer, less committal language for cold outreach emails
  - Updated in all 4 email templates (personalized HTML/text, bar profile HTML/text)
- [x] **Removed Redundant Copy** - Eliminated duplicate "Cancel anytime" messaging
  - Previously had both pricing line AND follow-up paragraph mentioning cancellation
  - Removed "No commitment. Cancel anytime if it's not right for your firm." paragraph
  - Pricing line now serves as single source for cancellation messaging
- [x] **Removed "No contracts" Claim** - Updated pricing line for accuracy
  - A Stripe subscription is technically a contract
  - Changed from "$99/month. No contracts. Cancel anytime." to "$99/month. Cancel anytime."
  - More accurate and less potentially misleading

**Files Modified:**
| File | Changes |
|------|---------|
| `scripts/send-preintake-campaign.js` | CTA labels, removed redundant copy, updated pricing line |

### Phase 80: Analytics Benchmark Reset to Feb 25, 2026 (2026-02-25)
- [x] **Fresh Analytics Start** - Reset benchmark date after significant changes
  - Changed `ANALYTICS_BENCHMARK_DATE` from `2026-02-24` to `2026-02-25`
  - All email campaign and lead engagement data now filtered from Feb 25 forward
  - Clean baseline after demo elimination and direct landing page conversion changes
- [x] **Strategic Insights Fix** - Fixed JSON parsing errors in AI insights generation
  - Added system prompt to guide Claude to return clean JSON without markdown
  - Added string cleanup to remove newlines within quoted values
  - Added balanced brace extraction as robust parsing fallback
  - Added error context logging for debugging

**Rationale:** Starting fresh after major strategic pivot (demo elimination) and fixing strategic insights JSON parsing. Clean baseline ensures metrics reflect new conversion flow without contaminated historical data.

**Files Modified:**
| File | Changes |
|------|---------|
| `functions/widget-functions.js` | Updated `ANALYTICS_BENCHMARK_DATE` to `2026-02-25`, fixed `generatePreIntakeInsights()` JSON parsing |

### Phase 81: Email Messaging Overhaul - "Triage" Framing (2026-02-25/26)
- [x] **Messaging Pivot** - Complete rewrite of email body copy
  - Changed from feature-focused to problem-focused "triage" framing
  - Core message: "Most law firms treat intake as data collection. It's not. It's triage."
  - Emphasis on strongest matters rising to the top without staff time investment
- [x] **Unified Template** - Consolidated to single v9-landing-page template
  - Deprecated separate v6-personalized-demo, v7-bar-profile-demo, v8-bar-profile-demo templates
  - Same messaging for all contact types (website and bar profile)
  - Template version: `v9-landing-page`
- [x] **Key Messaging Elements**:
  - Problem statement: Raw narratives compete for attention, best matters get buried
  - Solution: "Practice-specific screening in front of your intake workflow"
  - Value props: Case summary, qualification rating (qualified/needs review/not a fit), plain-English rationale
  - Trust signals: Zero Data Retention, works as embed OR hosted link
  - Pricing: $99/month. Cancel anytime.
- [x] **3x Click Rate Improvement** - Dramatic performance increase
  - Before change (Fri-Tue): 3.0% - 4.4% click rate baseline
  - After change: Wed 7.6%, Thu 13.1% click rate
  - Thursday achieved 3x baseline performance
- [x] **Strategic Insights Update** - Removed demo references from AI analytics
  - Updated `generatePreIntakeInsights()` prompt to reflect new funnel
  - Changed terminology: "Demo Viewed" → "Landing Page Visits"
  - Updated funnel: Email → Landing Page → Create Account → Paid Subscriber
  - Moved Strategic Insights section to bottom of analytics dashboard

**Performance Data:**
| Day | Sent | Visited | Click Rate |
|-----|------|---------|------------|
| Thu, Feb 26 | 199 | 26 | **13.1%** |
| Wed, Feb 25 | 671 | 51 | **7.6%** |
| Tue, Feb 24 | 399 | 12 | 3.0% |
| Mon, Feb 23 | 396 | 16 | 4.0% |
| Fri, Feb 20 | 389 | 17 | 4.4% |

**Rationale:** Feature-focused messaging (v6-v8) averaged 3-4% click rates. Shifting to problem-focused "triage" framing that emphasizes efficiency and prioritization resonated strongly with law firm intake pain points.

**Files Modified:**
| File | Changes |
|------|---------|
| `scripts/send-preintake-campaign.js` | Complete email body rewrite, unified v9 template |
| `functions/widget-functions.js` | Updated `generatePreIntakeInsights()` to remove demo references |
| `preintake/preintake-analytics.html` | Moved Strategic Insights to bottom of page |

### Phase 82: Contact Type Ratio Optimization (2026-02-26)
- [x] **Data-Driven Ratio Change** - Updated proportional selection from 50/50 to 70/30
  - Website contacts: 13.6% visit rate (3.3x higher than bar profile)
  - Bar profile contacts: 4.1% visit rate
  - New ratio prioritizes higher-converting website contacts
- [x] **Queue Analysis**:
  - Website contacts remaining: 29,320 (51% of queue)
  - Bar profile contacts remaining: 28,174 (49% of queue)
  - Balanced queue allows ratio optimization without abandoning either type
- [x] **Expected Impact**:
  - Visits per batch: 8.85 (old) → 10.75 (new) = **21% increase**
  - Website queue depletion: 147 days → 105 days
  - Bar profile queue depletion: 141 days → 235 days
- [x] **Template Version Fix** - Unified `templateVersion` field
  - Removed conditional v6-generic/v8-bar-profile/v6-personalized logic
  - All sends now record `v9-landing-page` for accurate analytics

**Files Modified:**
| File | Changes |
|------|---------|
| `scripts/send-preintake-campaign.js` | Changed ratio from 50/50 to 70/30, unified templateVersion to v9-landing-page |

### Phase 83: "Get Started" Flow for Organic Visitors (2026-02-27)
- [x] **New Registration Flow** - Direct signup path for organic visitors (not from email campaigns)
  - Created `/new-account.html` registration form page
  - Form collects: Name, Email, Firm Name (optional), Primary Practice Area, Additional Practice Areas, Website (optional)
  - 39 practice areas + "General Practice" + "Other (specify)" options
  - Primary dropdown disables corresponding checkbox in additional areas grid
  - Separate "Other" text input for primary selection (appears directly below dropdown)
  - Separate "Other" text input for additional areas (appears when checkbox selected)
- [x] **New Cloud Function** - `submitNewAccount` in `preintake-functions.js`
  - Creates document in `preintake_leads` collection with `status: 'pending_payment'`
  - Combines primary + additional practice areas into single `practiceAreas` array
  - Handles "Other" custom values for both primary and additional areas
  - Sets `source: 'organic_signup'` for analytics tracking
  - Returns `leadId` for redirect to `create-account.html?lead={id}`
- [x] **Header Navigation Update** - Changed "Demo" → "Get Started" in `components.js`
  - Links to `/new-account.html` for organic visitors
- [x] **Hero CTA Update** - Changed "See How It Works" → "Get Started" in `index.html`
  - Links to `/new-account.html`
  - Demo CTA Section hidden (commented out)
- [x] **Duplicate Handling** - Returning users redirected to existing checkout
  - If email exists in `preintake_leads`, returns existing `leadId`
  - Frontend shows "Welcome back!" message and redirects to `create-account.html`
- [x] **Bug Fix** - "Other" text input visibility for Primary Practice Area
  - Added separate `primary-other-container` below primary dropdown
  - Split visibility logic into `updatePrimaryOtherVisibility()` and `updateAdditionalOtherVisibility()`

**New Flow (Organic Visitors):**
```
Homepage → "Get Started" → new-account.html (form) → create-account.html?lead={id} → Payment
```

**Campaign Visitors (unchanged):**
```
Email CTA → Homepage (?lead=) → create-account.html → Payment
```

**Files Created:**
| File | Purpose |
|------|---------|
| `/preintake/new-account.html` | Registration form for organic visitors |

**Files Modified:**
| File | Changes |
|------|---------|
| `functions/preintake-functions.js` | Added `submitNewAccount` Cloud Function |
| `functions/index.js` | Export `submitNewAccount` |
| `preintake/js/components.js` | Changed "Demo" → "Get Started" in header |
| `preintake/index.html` | Changed hero CTA text + link, hid Demo CTA Section |
| `preintake/css/styles.css` | Added form styling for new-account.html |

### Phase 84: Domain Switch to legal.preintake.ai (2026-02-28)
- [x] **New Sending Domain** - Switched from `law.preintake.ai` to `legal.preintake.ai`
  - `law.preintake.ai` had prior spam issues; starting fresh with new domain
  - `legal.preintake.ai` activated in Mailgun with SPF/DKIM/DMARC configured
  - Parent domain `preintake.ai` created Dec 26, 2025 (~2 months old)
- [x] **Campaign Script Updates** - `scripts/send-preintake-campaign.js`
  - Changed `MAILGUN_DOMAIN` default: `law.preintake.ai` → `legal.preintake.ai`
  - Changed `FROM_ADDRESS`: `stephen@law.preintake.ai` → `stephen@legal.preintake.ai`
  - Added Gmail exclusion support (`EXCLUDE_GMAIL` env var, `isGmailEmail()` function)
  - Gmail domains: `gmail.com`, `googlemail.com`
- [x] **Workflow Updates** - `.github/workflows/preintake-email-campaign.yml`
  - Added `MAILGUN_DOMAIN: legal.preintake.ai` env var
  - Added `EXCLUDE_GMAIL: 'true'` for week 1 domain warming
  - Updated failure notification to use `legal.preintake.ai`
- [x] **Conservative Warming Strategy** - Starting fresh with reduced volume
  - Batch size: 25 (set via Firestore `preintakeBatchSize`)
  - Gmail excluded week 1 (aggressive spam filtering)
  - 4-week warming schedule: 25 → 50 → 75 → 100

**Domain Warming Schedule:**
| Week | Batch Size | Gmail | Notes |
|------|------------|-------|-------|
| 1 | 25 | Excluded | Conservative start |
| 2 | 50 | Enabled | Remove `EXCLUDE_GMAIL` from workflow |
| 3 | 75 | Enabled | Ramp continues |
| 4+ | 100 | Enabled | Full capacity |

**To disable Gmail exclusion after week 1:** Remove `EXCLUDE_GMAIL: 'true'` line from workflow.

**Files Modified:**
| File | Changes |
|------|---------|
| `scripts/send-preintake-campaign.js` | Domain defaults, FROM address, Gmail exclusion logic |
| `.github/workflows/preintake-email-campaign.yml` | Domain env var, Gmail exclusion, failure notification |

### Phase 85: Analytics Dashboard Simplification (2026-03-01)
- [x] **Removed Strategic Insights** - Eliminated Claude API calls causing OOM errors
  - Removed `generatePreIntakeInsights()` call from `getEmailAnalytics` Cloud Function
  - Removed `anthropicApiKey` secret from function definition
  - Removed Strategic Insights section from frontend dashboard
  - Fixes 500 errors from memory exhaustion
- [x] **Dashboard Simplification** - Reduced complexity for faster load times
  - Removed Lead Details table (SECTION 7)
  - Removed Traffic Sources table from GA4 section
  - Removed Source Performance table
  - Consolidated duplicate CSS (`.leads-table`, `.traffic-table`, `.perf-table` → `.data-table`)
  - Removed unused JS functions (`formatSource`, `formatBarSource`)
  - File size reduced from 968 to 801 lines (17% smaller)
- [x] **Fixed totalContacts Calculation** - Email Database metrics now accurate
  - Changed from `totalContacts = totalPending` to `totalContacts = totalSent + totalPending + totalUnsubscribed + totalFailed`
  - "Total Contacts" now shows actual database total, "remaining" shows unsent count
- [x] **Fixed Template Mapping** - Contact Type Performance labels
  - Added `v9-landing-page` → "All Contacts" (current template)
  - Relabeled legacy templates (v6, v7, v8) with "(Legacy)" suffix

**Files Modified:**
| File | Changes |
|------|---------|
| `functions/widget-functions.js` | Removed Strategic Insights, fixed totalContacts calculation |
| `preintake/preintake-analytics.html` | Dashboard simplification, template mapping fix |

### Phase 86: Dual-Domain Email Strategy - Gmail via law.preintake.ai (2026-03-05)
- [x] **Gmail Deliverability Fix** - law.preintake.ai delivers to Gmail inbox, legal.preintake.ai goes to spam
  - Tested spam monitor with both domains; law.preintake.ai consistently lands in inbox
  - Created separate Gmail-specific campaign using law.preintake.ai
- [x] **Gmail Campaign Script** - `scripts/send-preintake-campaign-gmail.js`
  - Uses `law.preintake.ai` domain and FROM address
  - `GMAIL_ONLY = true` - filters to ONLY send to gmail.com/googlemail.com contacts
  - Batch size from Firestore `config/emailCampaign.preintakeGmailBatchSize`
  - Inverts the EXCLUDE_GMAIL logic to INCLUDE_ONLY_GMAIL
- [x] **Gmail Campaign Workflow** - `.github/workflows/preintake-email-campaign-gmail.yml`
  - Uses `PREINTAKE_LAW_MAILGUN_API_KEY` secret
  - Same 4x daily Mon-Fri schedule as main campaign
  - Batch size controlled via Firestore (no warming calculation)
- [x] **Spam Monitor Domain Update** - Now uses law.preintake.ai
  - Script already updated to use law.preintake.ai domain
  - Tests Gmail inbox placement for the domain that actually sends to Gmail
- [x] **GitHub Secrets Standardization** - Clearer naming convention
  - `PREINTAKE_LEGAL_MAILGUN_API_KEY` - for legal.preintake.ai (main campaign, non-Gmail)
  - `PREINTAKE_LAW_MAILGUN_API_KEY` - for law.preintake.ai (Gmail campaign + spam monitor)

**Dual-Domain Strategy:**
| Domain | Purpose | Contacts | Secret |
|--------|---------|----------|--------|
| `legal.preintake.ai` | Main campaign | Non-Gmail (Yahoo, Outlook, etc.) | `PREINTAKE_LEGAL_MAILGUN_API_KEY` |
| `law.preintake.ai` | Gmail campaign | Gmail only | `PREINTAKE_LAW_MAILGUN_API_KEY` |

**Firestore Batch Size Config:**
| Field | Campaign | Default |
|-------|----------|---------|
| `preintakeBatchSize` | Main (legal.preintake.ai) | From warming schedule |
| `preintakeGmailBatchSize` | Gmail (law.preintake.ai) | 2 |

**Files Created:**
| File | Purpose |
|------|---------|
| `scripts/send-preintake-campaign-gmail.js` | Gmail-only campaign using law.preintake.ai |
| `.github/workflows/preintake-email-campaign-gmail.yml` | Gmail campaign workflow |

**Files Modified:**
| File | Changes |
|------|---------|
| `scripts/preintake-spam-monitor.js` | Domain changed to law.preintake.ai |
| `.github/workflows/preintake-spam-monitor.yml` | Uses `PREINTAKE_LAW_MAILGUN_API_KEY` |
| `.github/workflows/preintake-email-campaign.yml` | Uses `PREINTAKE_LEGAL_MAILGUN_API_KEY` |

### Phase 87: Organic Visitor Demo Experience & Scraper Audit (2026-03-13)
- [x] **"Experience Live Demo" Link** - Added text link for organic visitors to access demo
  - New link below hero CTA: "Experience Live Demo →" with 1.25rem font size
  - Uses `showDemoSection(event)` to scroll to and reveal demo section
  - Demo CTA Section conditionally shown (not permanently hidden)
- [x] **Section Background Styling** - Improved visual contrast between sections
  - Steps section (`#steps-section`): Grey background with `section-dark` class
  - Pricing section: White background (no dark class)
  - Consistent alternating pattern across landing page
- [x] **"2 Simple Steps" Section** - Updated from previous "3 Simple Steps"
  - Step 1: Choose Your Practice Areas
  - Step 2: Create Your Account
- [x] **Scraper Audit** - Verified active vs disabled bar scrapers
  - **5 Active scrapers**: calbar, flbar, ohbar, ncbar, wsba
  - **10 Disabled scrapers**: gabar, mibar, nebar, inbar, msbar, mobar, nsba, okbar, ilbar, kybar
  - Updated documentation to reflect accurate counts (was incorrectly listed as 8 active)
- [x] **Deprecated Script Notice** - Scripts scheduled for March 1, 2026 deletion still exist
  - `regenerate-preintake-demos.js` - Still present (no longer used, can be deleted)
  - `regenerate-bar-profile-demos.js` - Still present (no longer used, can be deleted)
  - These are no longer needed since demos are served dynamically via `/intake.html?demo={leadId}`

**Files Modified:**
| File | Changes |
|------|---------|
| `/preintake/index.html` | Demo text link, section backgrounds, 2 Simple Steps |
| `/preintake/CLAUDE.md` | Version 7.7, scraper counts, Phase 87 documentation |

---

## Architecture

### Status Flow
```
pending → analyzing → researching → generating_demo → demo_ready
```

### File Structure

```
/preintake/
├── index.html              # Landing page (redirects ?demo= to /demo/, ?lead= to create-account)
├── new-account.html        # "Get Started" registration form for organic visitors
├── create-account.html     # Account activation + Stripe checkout
├── payment-success.html    # Post-payment success page
├── account.html            # My Account page (subscriber portal)
├── about-us.html           # About us page
├── contact-us.html         # Contact form page
├── faq.html                # FAQ with accordion
├── preintake-analytics.html    # Campaign analytics dashboard (GA4-powered)
├── how-it-works-schematic.html  # Visual schematic of PreIntake.ai flow
├── privacy-policy.html     # Privacy policy
├── terms-of-service.html   # Terms of service
├── unsubscribe.html        # Email unsubscribe confirmation page
├── preintake.html          # Legacy intake page (standalone)
├── intake.html             # Master demo intake template (simplified header: Home + Create Account)
├── debug-flow.html         # Debug tool for demo/explore flow testing
├── sitemap.xml             # SEO sitemap (6 pages)
├── robots.txt              # Search engine directives
├── intake-button.js        # Embeddable floating button
├── widget.js               # Embeddable inline widget
├── intake-button-test.html # Widget test page (noindex)
├── widget-test.html        # Another widget test page (noindex)
├── EMBED-INSTRUCTIONS.md   # Client embed documentation
├── CLAUDE.md               # Project documentation
├── css/
│   └── styles.css          # Shared CSS (campaign-welcome, floating buttons, demo page styles)
├── demo/
│   └── index.html          # Dedicated demo page (welcome screen, iframe, exit modal)
├── js/
│   └── components.js       # Shared header/footer/welcome banner/floating buttons
└── images/
    ├── icon.svg            # Site icon/favicon (gold #c9a962)
    ├── icon.png            # PNG version of site icon
    └── og-image.png        # Open Graph social sharing image (1200x630)

/functions/
├── preintake-functions.js           # Form submission handler
├── preintake-analysis-functions.js  # Website analysis
├── deep-research-functions.js       # Multi-page scraping
├── demo-generator-functions.js      # Demo page generation
├── intake-delivery-functions.js     # Intake webhook + delivery
├── widget-functions.js              # Widget endpoints + getEmailAnalytics
├── stripe-functions.js              # Payment processing
├── account-portal-functions.js      # Account portal (magic link auth, settings, billing)
├── fix-firmname-issues.js           # Fix clear firmName errors (N/A, emails, URLs, etc.)
├── fix-ncbar-firmnames.js           # Extract firm names from NC Bar concatenated addresses
└── templates/
    ├── demo-intake.html.template    # LEGACY - Static demo template (no longer used for serving)
    └── demo-config.js               # LEGACY - Demo config template

/scripts/
├── send-preintake-campaign.js       # Email campaign sender (main, legal.preintake.ai)
├── send-preintake-campaign-gmail.js # Gmail-specific campaign using law.preintake.ai
├── analyze-click-rate.js            # Email click rate analysis
├── send-preintake-campaign.js       # Email campaign sender
├── scrape-calbar-attorneys.js       # California Bar attorney scraper (CSS email obfuscation)
├── scrape-flbar-attorneys.js        # Florida Bar attorney scraper (Cloudflare obfuscation)
├── scrape-gabar-attorneys.js        # Georgia Bar attorney scraper (Puppeteer/JS-rendered)
├── scrape-ilbar-attorneys.js        # Illinois Bar attorney scraper (Puppeteer + vCard + category validation)
├── scrape-inbar-attorneys.js        # Indiana Bar attorney scraper (ReliaGuide/no practice areas)
├── scrape-kybar-attorneys.js        # Kentucky Bar attorney scraper (Puppeteer/iframe CV5)
├── scrape-mibar-attorneys.js        # Michigan Bar attorney scraper (ReliaGuide/vCard + category validation)
├── scrape-mobar-attorneys.js        # Missouri Bar attorney scraper (Puppeteer/ASP.NET)
├── scrape-msbar-attorneys.js        # Mississippi Bar attorney scraper (ReliaGuide + category validation)
├── scrape-ncbar-attorneys.js        # North Carolina Bar attorney scraper (rewritten, Puppeteer/dropdown)
├── scrape-nebar-attorneys.js        # Nebraska Bar attorney scraper (ReliaGuide/keyword matching)
├── scrape-ohiobar-attorneys.js      # Ohio Bar attorney scraper (Puppeteer/checkbox, 167 cities)
├── scrape-okbar-attorneys.js        # Oklahoma Bar attorney scraper (simple HTML tables)
├── scrape-wsba-attorneys.js         # Washington State Bar attorney scraper (Puppeteer/checkbox filtering)
├── scrape-nsba-attorneys.js         # Nebraska State Bar Association attorney scraper (YourMembership)
├── gov-filter-utils.js              # Shared government contact filtering module
├── cleanup-gov-contacts.js          # Remove government contacts from preintake_emails
├── audit-gov-contacts.js            # Audit for remaining government contacts
├── fetch-bar-categories.js          # Fetch practice area categories from bar associations
├── fetch-bar-categories-2.js        # Fetch categories (pass 2: network intercept approach)
├── enrich-flbar-profiles.js         # FL Bar profile enrichment (website extraction)
├── backfill-flbar-member-urls.js    # Backfill memberUrl for existing FL Bar contacts
├── diagnose-flbar-data.js           # Analyze FL Bar data distribution
├── reset-flbar-data.js              # Reset FL Bar data for clean re-scrape
├── analyze-sources.js               # Analyze preintake_emails by source (scraper vs legacy)
├── audit-preintake-emails.js        # Audit data integrity for send-preintake-campaign.js
├── infer-websites.js                # Infer attorney websites from email domains
├── cleanup-stale-demos.js           # Auto-delete 15+ day old never-accessed demos (daily workflow)
└── sync-mailgun-failures.js         # Auto-mark bounced emails as failed (daily workflow)
```

### Firebase Configuration

| Resource | Value |
|----------|-------|
| Hosting Target | `preintake-ai` |
| Domain | preintake.ai |
| Firestore Database | `preintake` (separate from TBP) |
| Storage Bucket | `teambuilder-plus-fe74d.firebasestorage.app/preintake-demos/` |
| Functions Region | `us-west1` |

---

## Security Features

### Landing Page (`/preintake/index.html`)
- Honeypot field (hidden input that bots fill)
- Client-side rate limiting (3 submissions/day via localStorage)
- Email validation with typo detection
- Fake domain blocking

### Backend (`preintake-functions.js`)
- Server-side IP rate limiting (5 submissions/day/IP via Firestore)
- IP address hashing with SHA256 for privacy
- Law firm website validation (40+ legal keywords, requires 2+ matches)
- Email validation with MX record lookup
- Disposable email domain blocking (20+ domains)

### Demo Intake (`/preintake/intake.html`)
- Email validation in chat interface
- Phone validation (US and international)
- Typo detection and suggestions
- Fake domain blocking
- Session recovery with 24-hour TTL
- Deduplication (prevents duplicate submissions)

---

## Demo Generation Flow

### Lead Analysis (Firestore-based)
1. **Lead submits form** → `submitDemoRequest` function
2. **Validation passes** → Store in Firestore with status `pending`
3. **Confirmation email** → Sent to prospect immediately
4. **New lead notification** → Sent to Stephen
5. **Analysis triggers** → `analyzePreIntakeLead` (Firestore onCreate)
6. **Website scraped** → Extract firm name, practice areas, branding
7. **Deep research runs** → `performDeepResearch`
8. **Additional pages scraped** → Attorneys, case results, testimonials
9. **Claude structures data** → Using Haiku for cost efficiency
10. **Status updated** → `demo_ready` status set in Firestore
11. **Demo ready emails** → Sent to BOTH prospect (`sendProspectDemoReadyEmail`) AND Stephen

### Dynamic Serving (Phase 73+)
Demos are served dynamically from a master template—no static files generated:
- User visits `preintake.ai/demo/{leadId}`
- `serveDemo()` redirects to `/intake.html?demo={leadId}`
- Master template loads, calls `getWidgetConfig?firmId={leadId}`
- API returns firm config (name, colors, practice areas, mode flags)
- JavaScript renders firm-specific UI dynamically

**Note:** Legacy static file generation code still exists but is scheduled for removal on March 1, 2026.

---

## Lead Delivery Configuration

### Strategy: Default to Email, Upgrade Later

**Rationale:** Minimize friction at checkout. Get customers activated immediately, then offer CRM integration as a post-activation enhancement.

**Flow:**
```
1. Customer pays → Account activated → Inquires delivered via EMAIL (default)
2. Welcome email includes: Embed code + "Configure CRM Integration" link
3. Customer can optionally set up CRM/webhook delivery later
```

### Delivery Methods

| Method | Description | Status |
|--------|-------------|--------|
| **Email** (Default) | HTML summary to firm's intake email | ✅ Implemented |
| **Webhook** | POST JSON to custom URL (Zapier-compatible) | ✅ Implemented |
| **Native CRM** | Direct API integration | 🔮 Future |

---

## CRM Integration Research

**PreIntake.ai sits in front of intake CRMs** (Lawmatics, Clio Grow, Filevine) — we're a gatekeeper, not a data janitor.

**Current State:**
- Email delivery (default) ✅
- Webhook delivery (Zapier, custom integrations) ✅
- **This covers ~80% of buyers today**

**Build Criteria:** Don't build native CRM integrations until 5+ paying customers request the same one.

---

## Compliance

### Built-in Protections
- No attorney-client relationship disclaimer (ethics-rule compliant)
- AI usage disclosure (aligned with state bar guidance)
- Confidentiality boundaries pre-engagement
- Decline messaging that avoids unauthorized practice of law
- Data retention and deletion capability
- HTTPS encryption, US-based hosting

### Configurable by Jurisdiction
Our system adapts disclaimers and screening logic to each state's requirements. Multi-state firms get automatic routing based on case location.

### Data Privacy
- PreIntake.ai does NOT retain client data
- All intake information is immediately delivered and discarded
- CCPA/GDPR compliance statements in Privacy Policy
- Third-party services disclosed (Stripe, Claude AI, Firebase)

---

## Deployment Model

**We host everything. Customers focus on cases.**

Intake runs on our infrastructure:
- Dedicated URL (e.g., `intake.smithlaw.com` via CNAME, or `smithlaw.preintake.ai`)
- We manage the AI, hosting, security, and updates
- Customer provides branding assets and webhook endpoint
- Updates and improvements deploy automatically

**Why this model:**
1. We can prove ROI with real conversion data
2. Bug fixes and improvements benefit all clients instantly
3. No IT burden on law firms
4. Compliance updates happen automatically

For firms with strict data residency requirements, self-hosted option at custom pricing.

---

## Current Gaps & Future Improvements

**Recently Completed:**
- ✅ Post-intake conversion email (Phase 17) - Sends after first demo lead delivery
- ✅ Demo ready notification to customer - Sends via `sendProspectDemoReadyEmail()` when demo is generated
- ✅ Customer Portal - `account.html` with magic link auth, settings management, Stripe billing portal
- ✅ Analytics Dashboard - `preintake-analytics.html` with GA4 integration, email stats, engagement funnel, AI strategic insights (Phase 63)
- ✅ Demo Expiration - `cleanup-stale-demos.js` auto-deletes 15+ day old never-accessed demos (daily workflow)
- ✅ A/B Testing (Subject Lines) - Subject line variants tracked via `subjectTag` field with dashboard reporting

| Gap | Current State | Planned Solution | Priority |
|-----|---------------|------------------|----------|
| CRM integrations | Email/webhook only (covers 80%) | Native integrations when 5+ customers request same CRM | Low (deferred) |
| Multi-language support | English only | Spanish, Chinese intake options | Low |
| A/B testing (question flows) | Subject lines only | Question flow optimization | Low |

---

## Operations & Maintenance

> **DEPRECATION NOTICE (Phase 73):** The gsutil patching and regeneration sections below are only relevant until March 1, 2026. After that date, all static demo files will be deleted and demos will be served dynamically via `/intake.html?demo={leadId}`. Template updates will deploy instantly via `firebase deploy --only hosting:preintake-ai`.

### Fast Demo Patching (gsutil) — DEPRECATED

For simple text changes to demo templates (CSS, copy, JS snippets), use **gsutil parallel operations** instead of sequential regeneration. This is **15x faster** (~3 min vs ~45 min for 1,400+ demos).

**When to use:** Simple find/replace changes that don't require regenerating the full template (e.g., wording changes, CSS fixes, JS tweaks).

**When NOT to use:** Structural changes that require `generateDemoFiles()` logic (e.g., new placeholders, practice-area-specific content).

**Process:**
```bash
# 1. Create patch script
cat << 'EOF' > /tmp/fast-patch-demos.sh
#!/bin/bash
set -e
BUCKET="gs://teambuilder-plus-fe74d.firebasestorage.app"
PREFIX="preintake-demos"
TEMP_DIR="/tmp/preintake-demos-patch"

rm -rf "$TEMP_DIR" && mkdir -p "$TEMP_DIR"

# Parallel download (~23 sec for 1,400 demos)
gsutil -m cp -r "$BUCKET/$PREFIX" "$TEMP_DIR/"

# Find/replace locally (instant)
MODIFIED=0
for f in $(find "$TEMP_DIR" -name "index.html"); do
    if grep -q "OLD_TEXT" "$f" 2>/dev/null; then
        sed -i '' "s/OLD_TEXT/NEW_TEXT/g" "$f"
        ((MODIFIED++))
    fi
done
echo "Modified: $MODIFIED files"

# Parallel upload (~2-3 min)
gsutil -m -h "Content-Type:text/html" -h "Cache-Control:public, max-age=300" \
    cp -r "$TEMP_DIR/$PREFIX/*" "$BUCKET/$PREFIX/"

rm -rf "$TEMP_DIR"
EOF
chmod +x /tmp/fast-patch-demos.sh

# 2. Edit the sed command with your find/replace, then run:
/tmp/fast-patch-demos.sh
```

**Important notes:**
- Always update the template file first (`functions/templates/demo-intake.html.template`)
- The script patches ALL demos including `active` subscribers (not just `demo_ready`)
- Cache-Control is 5 minutes, so changes propagate quickly
- For `active` leads that need full regeneration, use manual regeneration (see below)

### Full Demo Regeneration — DEPRECATED

For structural template changes requiring `generateDemoFiles()`:

```bash
# Regenerate all demo_ready leads
node scripts/regenerate-preintake-demos.js --run

# Regenerate specific lead (works for any status)
cd /Users/sscott/tbp/functions && node << 'EOF'
const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(require('../secrets/serviceAccountKey.json')),
    storageBucket: 'teambuilder-plus-fe74d.firebasestorage.app'
});
const { generateDemoFiles } = require('./demo-generator-functions');
const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

async function regen(leadId) {
    const doc = await db.collection('preintake_leads').doc(leadId).get();
    const { htmlContent } = generateDemoFiles(leadId, doc.data(), doc.data().analysis || {}, doc.data().deepResearch || {});
    await admin.storage().bucket().file(`preintake-demos/${leadId}/index.html`).save(htmlContent, {
        contentType: 'text/html',
        metadata: { cacheControl: 'public, max-age=300' }
    });
    console.log('Done');
}
regen('LEAD_ID_HERE').then(() => process.exit(0));
EOF
```

**Note:** The regeneration script (`regenerate-preintake-demos.js`) only processes `demo_ready` leads. For `active` subscribers, use the manual script above.

---

## Technical Reference

### Key Cloud Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `submitDemoRequest` | HTTP | Handle demo request form submission |
| `submitNewAccount` | HTTP | Handle "Get Started" registration form for organic visitors |
| `submitHostedDemoRequest` | HTTP | Handle hosted demo requests (bar profiles without websites) |
| `submitPreIntakeContact` | HTTP | Handle contact form submissions |
| `verifyDemoEmail` | HTTP | Verify email before demo starts |
| `analyzePreIntakeLead` | Firestore onCreate | Analyze website, trigger deep research |
| `analyzeAfterEmailVerification` | Firestore onUpdate | Trigger analysis after email verified |
| `generatePreIntakeDemo` | Firestore onUpdate | Generate demo intake page |
| `handleIntakeCompletion` | HTTP | Process completed intake, deliver lead |
| `confirmPracticeAreas` | HTTP | Handle practice area confirmation from intake |
| `getPreIntakeFirmStatus` | HTTP | Check subscription status for Demo/Live mode |
| `trackDemoView` | HTTP | Track demo page visits and views |
| `createCheckoutSession` | HTTP | Create Stripe checkout session |
| `getStripeConfig` | HTTP | Return publishable key and pricing |
| `stripeWebhook` | HTTP | Handle Stripe subscription events |
| `verifyCheckoutSession` | HTTP | Verify payment status |
| `serveDemo` | HTTP | Proxy demo HTML for CORS bypass |
| `serveHostedIntake` | HTTP | Serve intake by bar number OR 6-digit short code |
| `resendActivationEmail` | HTTP | Admin endpoint to resend activation emails |
| `handlePreIntakeUnsubscribe` | HTTP | Handle email unsubscribe requests |
| `getWidgetConfig` | HTTP | Return widget configuration |
| `intakeChat` | HTTP | AI chat endpoint |
| `sendAccountAccessLink` | HTTP | Send magic link email for account portal |
| `verifyAccountToken` | HTTP | Verify magic link token, return account data |
| `updateAccountSettings` | HTTP | Update delivery email, practice areas, name |
| `createBillingPortalSession` | HTTP | Create Stripe billing portal session |
| `getEmailAnalytics` | HTTP | Return campaign analytics (GA4 + Firestore + AI insights) |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/submitDemoRequest` | POST | Submit demo request |
| `/submitNewAccount` | POST | Submit "Get Started" registration form |
| `/submitHostedDemoRequest` | POST | Submit hosted demo request (bar profiles) |
| `/submitPreIntakeContact` | POST | Submit contact form |
| `/verifyDemoEmail` | POST | Verify email before demo starts |
| `/confirmPracticeAreas` | POST | Confirm practice area selection |
| `/handleIntakeCompletion` | POST | Deliver completed intake |
| `/getPreIntakeFirmStatus` | GET | Check firm subscription status |
| `/trackDemoView` | GET | Track demo page visits and views |
| `/createCheckoutSession` | POST | Create Stripe checkout |
| `/getStripeConfig` | GET | Get Stripe public config |
| `/stripeWebhook` | POST | Stripe webhook handler |
| `/verifyCheckoutSession` | GET | Verify checkout completion |
| `/demo/:firmId` | GET | Serve demo intake page |
| `/:intakeCode` | GET | Serve hosted intake by 6-digit short code (via serveHostedIntake) |
| `/intake/:barNumber` | GET | Serve hosted intake by bar number (via serveHostedIntake) |
| `/resendActivationEmail` | GET | Admin: resend activation email |
| `/handlePreIntakeUnsubscribe` | GET | Handle email unsubscribe |
| `/sendAccountAccessLink` | POST | Send magic link email for account portal |
| `/verifyAccountToken` | GET | Verify magic link, return account data |
| `/updateAccountSettings` | POST | Update account settings |
| `/createBillingPortalSession` | POST | Create Stripe billing portal session |
| `/getEmailAnalytics` | GET | Return campaign analytics (GA4 + Firestore) |

### Firestore Collections (preintake database)

| Collection | Purpose |
|------------|---------|
| `preintake_leads` | Lead records with status, analysis, delivery config (includes `intakeCode` field for short URLs) |
| `preintake_emails` | Attorney contacts for email campaigns (scraped from bar associations) |
| `intake_dedup` | Deduplication records (leadId_email_phone) |
| `account_tokens` | Magic link tokens for account portal authentication |
| `account_portal_rate_limits` | Rate limiting for magic link requests |
| `account_deletion_logs` | Audit log for account deletion requests |
| `scraper_progress/*` | Per-scraper progress tracking (practice areas completed, counts) |

### Firebase Storage

| Path | Purpose | Status |
|------|---------|--------|
| `preintake-demos/{leadId}/index.html` | Legacy static demo pages | **DEPRECATED** - Scheduled for deletion March 1, 2026 |

**Note:** As of Phase 73, demos are served dynamically via `/intake.html?demo={leadId}`. Static files in Storage are no longer generated and will be deleted on March 1, 2026.

---

## Success Metrics

1. **Email campaign**: Demo view rate (% of emails sent that result in demo page visit)
2. **Demo engagement**: Intake completion rate (% of demo views that complete the conversation)
3. **Sales pipeline**: Demo completion → account creation → payment
4. **Activation**: Payment → first embedded widget on live site
5. **Retention**: Monthly churn rate
6. **Platform**: Practice areas supported, firms onboarded, intakes processed

**Note:** "Demo generation" is not a success metric. Demos are pre-generated for all email recipients as part of the send pipeline. The first meaningful engagement metric is "demo viewed" (recipient clicked the email CTA).

---

## Known Issues & Historical Notes

### UTM Parameter "bhgefbdu" in GA4 (Jan 2026)
GA4 shows 7 users from `email/bhgefbdu` - a corrupted UTM medium parameter. Investigation confirmed:
- Current code correctly uses `utm_medium=outreach` with proper `encodeURIComponent()` encoding
- The "bhgefbdu" entries are legacy from before Mailgun tracking was disabled (Jan 2026)
- Mailgun's click tracking rewrote URLs before they were delivered, causing corruption
- **No fix needed** - these entries will naturally age out of GA4's 14-month retention window
- Current tracking uses Firestore-based `trackDemoView` (visit on page load, view on "Start Demo" click)

---

## Contact

**Stephen Scott**
stephen@preintake.ai

---

**Bottom line:** PreIntake.ai reduces junk intakes and surfaces real cases faster—without replacing your CRM or changing how law firms practice law.
