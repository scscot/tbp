# PreIntake.ai: Comprehensive Project Documentation

**Last Updated**: 2026-01-10
**Version**: 3.0 (Pre-Screen positioning + practice-area subtitle + audit fixes)

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

**Analytics Dashboard** (Future)
- Completion rate tracking (see where leads drop off)
- Green/Yellow/Red distribution by practice area
- Conversion tracking: leads → consults → signed cases
- A/B testable question flows (optimize for your audience)
- Monthly ROI reporting

---

## Customer Journey

### Overview

The PreIntake.ai customer journey spans 7 phases from initial discovery to ongoing subscription management.

```
Discovery → Demo → Payment → Onboarding → Implementation → Lead Flow → Subscription
```

### Phase 1: Discovery

**Entry Points:**
- Google search → preintake.ai landing page
- Referral from existing customer
- LinkedIn outreach / sales call
- Legal tech conferences / webinars

**User Actions:**
- Views landing page (practice areas, pricing, demo video)
- Enters law firm website URL in demo request form
- Provides email and practice area breakdown

**System Response:**
- Validates email (MX lookup, disposable domain check)
- Validates website (legal keyword detection)
- Stores lead in Firestore with status `pending`
- Sends confirmation email: "Your AI Intake Demo is Being Built"
- Notifies Stephen of new demo request

### Phase 2: Demo Generation

**Trigger:** Firestore onCreate for new lead document

**System Actions:**
1. Website Analysis (`analyzePreIntakeLead`)
   - Scrapes homepage for firm name, logo, colors, contact info
   - Extracts practice areas from navigation and content
2. Deep Research (`performDeepResearch`)
   - Discovers additional pages (attorneys, results, testimonials)
   - Extracts attorney names, bios, case results
   - Structures data with Claude Haiku
3. Demo Generation (`generatePreIntakeDemo`)
   - Applies firm branding to intake template
   - Configures practice-area-specific prompts
   - Uploads to Firebase Storage

**Output:**
- Working demo intake at `https://preintake.ai/demo/{leadId}`
- Demo ready email to Stephen with firm details and demo URL

**User Actions:**
- Receives demo URL (via Stephen or automated email)
- Tests intake conversation
- Sees their branding, practice areas, and screening logic in action
- Receives sample lead notification email

### Phase 3: Payment

**Entry:** User clicks "Activate Your Account" from demo page or direct link

**Page:** `/create-account.html?firm={leadId}`

**Flow:**
1. User reviews pricing ($149 setup + $99/month)
2. Clicks "Complete Setup" → Stripe Checkout
3. Stripe processes payment (setup fee + first month subscription)
4. Webhook (`checkout.session.completed`) → Updates Firestore
5. Redirect to `/payment-success.html`

**Account Activation:**
- `subscriptionStatus` set to `active`
- Customer receives activation email
- Stephen receives notification

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

**Billing:** Monthly via Stripe ($99/month after initial $248)

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
| **One-time Setup Fee** | $149 |
| **Monthly Subscription** | $99/mo |
| **Total Due Today** | **$248** |

### Setup Fee Includes:
- Practice-area template configuration
- Firm branding (logo, colors, messaging)
- Email delivery setup (webhook/CRM optional)
- Compliance review for your jurisdiction
- Working demo for approval

### Monthly Subscription Includes:
- Hosting and AI infrastructure
- Unlimited intakes
- Email support
- Ongoing updates and improvements
- Analytics dashboard (when available)

**No long-term contracts.** Cancel anytime.

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

**Intake Flow (Multi-Practice Firms):**
```
1. Collect name, phone, email
2. "What type of legal matter do you need help with?"
   → [Personal Injury] [Family Law] [Bankruptcy] (firm-specific buttons)
3. Branch to selected practice area's question flow
```

### Phase 8: Intake Delivery System
- [x] Create `intake-delivery-functions.js` with `handleIntakeCompletion`
- [x] Email delivery with professional HTML summary (default for demos)
- [x] Generic webhook delivery for custom CRM integration
- [x] Update `demo-generator-functions.js` to set webhook URL
- [x] Store `deliveryConfig` in Firestore with lead document
- [x] Export `handleIntakeCompletion` in index.js
- [x] Deploy functions

**Data Flow (No Retention):**
```
Intake completes → sendWebhook() → handleIntakeCompletion → Deliver via email/webhook → Discard data
```

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
| Environment | Setup Fee | Monthly Subscription |
|-------------|-------------------|---------------------|
| **Test** | `price_1SjQ1aJaJO3EHqOSH5tYPJOB` | `price_1SjNpAJaJO3EHqOSHh4DbhNM` |
| **Live** | `price_1SksYAJBdoLMDposleabMPli` | `price_1SmPbhJBdoLMDposfgTFIJSA` |

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

**Bug Fixes (2025-12-30):**
- [x] **Demo template create-account links** - Fixed missing `?firm={{LEAD_ID}}` parameter in `demo-intake.html.template` (lines 1332, 1427)
- [x] **Stripe webhook signature verification** - Updated `STRIPE_WEBHOOK_SECRET` to match Stripe Dashboard; added debug logging for signature mismatches

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

**SEO-Optimized Pages:**
| Page | Priority | Keywords Focus |
|------|----------|----------------|
| index.html | 1.0 | AI legal intake, automated client screening, law firm intake software |
| about-us.html | 0.8 | Legal tech company, AI intake mission |
| faq.html | 0.8 | Legal intake FAQ, AI screening questions |
| contact-us.html | 0.7 | Legal software support, demo request |
| privacy-policy.html | 0.3 | Data protection, GDPR/CCPA compliance |
| terms-of-service.html | 0.3 | Service agreement, subscription terms |

**Noindexed Pages:**
- create-account.html, payment-success.html, widget-test.html, intake-button-test.html, preintake.html

**Session Recovery Flow:**
```
User starts intake → Contact info collected → saveSession() to localStorage
         ↓
User closes browser
         ↓
User returns (within 24 hours) → loadSession() → Show recovery modal
         ↓
"Continue" → Restore conversation history → Resume from last message
"Start Fresh" → clearSession() → Begin new intake
```

### Phase 15: Project Audit (2025-12-30)
- [x] **Frontend HTML Audit** - Validated all 11 HTML files for structure and consistency
- [x] **Frontend JavaScript Audit** - Checked 4 JS files for syntax errors and patterns
- [x] **Backend Cloud Functions Audit** - Verified 8 function files and index.js exports
- [x] **Cross-file Consistency Check** - Confirmed pricing ($99/month + $149 setup) and email consistency
- [x] **Security Review** - Verified no hardcoded secrets, all use Firebase `defineSecret`
- [x] **Schema.org Fix** - Updated `priceValidUntil` from "2025-12-31" to "2026-12-31" (was expiring)
- [x] **OG Image Created** - Created `/preintake/images/og-image.png` (1200x630) for social sharing previews

### Phase 16: Branding & Icon (2025-12-30)
- [x] **Site Icon** - Created `/preintake/images/icon.svg` (gold #c9a962, filter funnel design)
- [x] **Favicon Integration** - Added favicon references to all 8 HTML pages
- [x] **Header Logo Icon** - Added icon inline with "PreIntake.ai" text in header
- [x] **Logo Size Increase** - Increased logo text and icon from 1.5rem to 1.75rem
- [x] **Header/Footer Background** - Changed from gradient to solid `#0a1628` for better contrast

**Branding Updates:**
| Element | Before | After |
|---------|--------|-------|
| Header background | `linear-gradient(135deg, #0c1f3f, #1a3a5c)` | `#0a1628` (solid) |
| Footer background | `#0c1f3f` | `#0a1628` (matches header) |
| Logo font size | 1.5rem | 1.75rem |
| Logo icon | None | `/images/icon.svg` (1.75rem) |
| Favicon | None | `/images/icon.svg` (all pages) |

**Audit Summary:**
| Category | Files | Status |
|----------|-------|--------|
| Frontend HTML | 11 | ✅ Pass |
| Frontend JavaScript | 4 | ✅ Pass |
| Backend Functions | 8 | ✅ Pass |
| Pricing Consistency | All | ✅ Pass |
| Security | All | ✅ Pass |
| API Endpoints | All | ✅ Pass |

### Phase 17: Email & UX Improvements (2025-12-31)
- [x] **Post-Demo Conversion Email** - Auto-send after first successful intake lead delivery
  - New `sendConversionEmail()` function in `intake-delivery-functions.js`
  - Tracks via `conversionEmailSent` and `conversionEmailSentAt` fields
  - Skips active/paid subscribers and already-sent leads
  - Subject: "Your PreIntake.ai Demo Just Captured a Lead"
  - CTA: Links to `https://preintake.ai/create-account.html?firm={leadId}`
- [x] **FROM Address Update** - Changed from `intake@preintake.ai` to `support@preintake.ai`
- [x] **Signature Update** - Changed from "Stephen Scott, Founder" to "Support Team, PreIntake.ai"
- [x] **JavaScript Parse Error Fix** - Escaped apostrophes in firm names that broke demo template
- [x] **Firm Name Extraction** - Improved extraction logic from analysis data
- [x] **Verification Email Re-click Fix** - Prevented page hang on second verification click
- [x] **Demo Template UI Fixes** - Fixed sidebar-cta centering and logo issues

**Conversion Email Flow:**
```
Intake completes → deliveryResult.success → Check conversionEmailSent flag
     ↓
If not sent AND status !== 'active' → sendConversionEmail()
     ↓
Email sent → Update Firestore: conversionEmailSent=true, conversionEmailSentAt=timestamp
```

### Phase 18: Email Outreach Campaign (2026-01-03)
- [x] **Email Campaign Script** - `scripts/send-preintake-campaign.js`
  - Sends outreach emails to law firms from Firestore `preintake_emails` collection
  - Uses Dreamhost SMTP via nodemailer (smtp.dreamhost.com:587)
  - Configurable batch size via `BATCH_SIZE` environment variable (default: 5)
  - 1-second delay between emails to avoid rate limiting
  - Tracks sent status, batch ID, message ID in Firestore
  - Template version: `v4-generic` (practice-agnostic messaging)
- [x] **GitHub Actions Workflow** - `.github/workflows/preintake-email-campaign.yml`
  - Scheduled: Mon-Fri at 10am and 2pm PT (cron: `0 18,22 * * 1-5`)
  - Manual trigger with configurable batch size
  - Uses `PREINTAKE_SMTP_USER` and `PREINTAKE_SMTP_PASS` secrets
  - Uses `FIREBASE_SERVICE_ACCOUNT` for Firestore access
- [x] **Unsubscribe System**
  - Cloud Function: `handlePreIntakeUnsubscribe` (updates Firestore status)
  - Unsubscribe page: `preintake.ai/unsubscribe.html`
  - Email footer includes personalized unsubscribe link
- [x] **SPF Authentication** - Fixed email deliverability
  - Added `include:relay.mailchannels.net` to SPF TXT record for legal.preintake.ai
  - Dreamhost routes through MailChannels relay servers
  - All three checks passing: SPF, DKIM, DMARC
- [x] **GitHub Secrets Configured**
  - `PREINTAKE_SMTP_USER`: scott@legal.preintake.ai
  - `PREINTAKE_SMTP_PASS`: Dreamhost SMTP password

**Email Template (v4-generic):**
- Subject: "A smarter way to screen intake inquiries before staff review"
- From: Stephen Scott <scott@legal.preintake.ai>
- Personalization: `${firmName}` in pre-CTA paragraph
- CTA: "Generate a Demo" → preintake.ai with UTM tracking
- Preview text: "How law firms reduce unqualified consultations without hiring more staff."

**Firestore Collection:** `preintake_emails` (in `preintake` database)
| Field | Description |
|-------|-------------|
| `firmName` | Law firm name |
| `email` | Contact email |
| `sent` | Boolean - email sent |
| `status` | `pending`, `sent`, `failed`, `unsubscribed` |
| `sentTimestamp` | When email was sent |
| `batchId` | Batch identifier |
| `messageId` | SMTP message ID |
| `subjectLine` | Subject line used |
| `templateVersion` | Template version (v4-generic) |
| `randomIndex` | Random number for shuffled sending order |

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
- [x] **LinkedIn Ad Campaign Plan** - Created comprehensive campaign documentation (`LINKEDIN_AD_CAMPAIGN_PLAN.md`)
  - Phased budget approach: $30/day (weeks 1-4) → $50-75/day (scaling)
  - Target: PI attorneys at small-mid firms (2-50 employees)
  - Unit economics: CPL <$25, Demo <$150, CAC <$1,000
  - A/B testing: Lead Gen Forms vs Landing Page traffic
  - Expansion roadmap: PI → Immigration → Family Law → Bankruptcy → Criminal Defense
- [x] **Hero CTA Stacked Layout** - Redesigned hero button with two-line format
  - Primary: "See It In Action →" with arrow icon
  - Subtext: "Watch a real inquiry get evaluated and routed"
  - Removes ambiguity about what clicking the CTA will show
- [x] **Outcome Statement** - Added clarity line in demo section
  - "Within weeks, your staff spends time only on viable matters."
  - Answers "what's different after this runs?" question
- [x] **Pricing Section Simplified** - Reduced risk-reversal text to essentials
  - Changed from multi-sentence value recap to: "Cancel anytime—no long-term contracts."

**Final Page Structure:**
```
1. Hero (paralegal comparison H1, Zero Data Retention trust signal, sticky CTA)
2. What Your Firm Receives (value proof)
3. Routing Section (GREEN/YELLOW/RED mechanics)
4. 3 Simple Steps (ease of implementation)
5. Demo Form (id="demo") with outcome statement
6. Practice Areas (supporting content)
7. Trust & Privacy
8. Pricing (with risk-reversal)
9. Footer
```

**Hidden Sections (commented out for future restoration):**
- Stats Bar
- Problem Section
- CRM Integration Note

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
  - Desktop: `padding: 4rem 2rem` (was 5rem/6rem in places)
  - Mobile: `padding: 3rem 1.5rem`
  - Applied to: `.hero`, `.section`, `.cta-section`
- [x] **Hero Privacy Font Size** - Increased visibility of trust signal
  - Changed from `0.875rem` to `1.05rem`
- [x] **Sitemap Update** - Updated homepage lastmod to 2026-01-08

- [x] **Scroll Cue** - Tested and removed
  - Added "See an example summary ↓" but removed after review
  - Hero flows better without it; sticky CTA handles scroll motivation
- [x] **Filtering Language Audit** - Comprehensive cleanup of filtering-implied language
  - Changed "screen/screened/screening" → "review/reviewed/reviewing" throughout
  - Changed "Screening Summary" → "Case Summary"
  - Changed "Screening Rationale" → "Assessment Rationale"
  - Changed "Screens:" → "Checks:" on all 6 practice area cards
  - Changed "Does Not Qualify" → "Not a Fit" (also "Disqualifier:" → "Reason:")
  - Changed "before it reaches your inbox" → "arrives in your inbox with"
  - Changed "Your Infrastructure" → "Your Branded Experience" (removed inaccurate "never leave your domain" claim)
  - Changed "Assistant:" → "Intake:" in transcript labels (avoids AI anxiety, cleaner abstraction)
    - Updated `demo-intake.html.template` formatTranscript() function (2 places)
    - Updated `intake-delivery-functions.js` email transcript formatting

**Hero Messaging Evolution:**
```
Before: "AI That Screens Like Your Best Paralegal"
After:  "AI That Reviews Inquiries
         Like Your Best Paralegal"
        - Creates safe mental bridge (paralegal comparison, not AI superiority claim)
        - "Reviews" eliminates filtering ambiguity that "screens" carried
        - Line break keeps "Like Your Best Paralegal" as complete phrase
        - Focuses on artifact delivered (summary, assessment, recommendation)
        - Keeps human in control ("ready for your review")
```

**Key Messaging Decisions:**
| Choice | Selected | Rationale |
|--------|----------|-----------|
| "Reviews" vs "Screens" | Reviews | "Screens" implied filtering; "Reviews" = assessment without gatekeeping |
| "review" vs "decision" | review | Keeps human in control, less pressure |
| "delivered" vs "arrives" | delivered | Active voice, service-oriented |
| Hero CTA vs Sticky CTA | Sticky | Encourages scroll, reduces bounce on cold traffic |
| Scroll cue | Removed | Tested but removed; hero flows better without it |

### Phase 21: Demo Improvements & Analytics (2026-01-10)
- [x] **Template File Rename** - Renamed `demo-intake.html` → `demo-intake.html.template`
  - Suppresses VS Code JavaScript validation errors on `{{placeholder}}` syntax
  - Updated all code references in `demo-generator-functions.js` and `regenerate-demos.js`
- [x] **Conditional Header Button** - Dynamic "Get Started" CTA for campaign visitors
  - Header shows "My Account" by default
  - After user clicks Campaign Hero CTA, header changes to "Get Started →"
  - Uses `sessionStorage` key `tbp_demo_viewed` to track demo views
  - Links directly to `create-account.html?firm={leadId}`
  - Gold gradient styling (`.nav-get-started` class) for prominent CTA
- [x] **Demo Regeneration Utility** - `scripts/regenerate-preintake-demos.js`
  - Regenerates all demos with latest template (fixes missing onboarding modal)
  - Supports dry-run mode: `node scripts/regenerate-preintake-demos.js`
  - Run mode: `node scripts/regenerate-preintake-demos.js --run`
  - Specific lead: `node scripts/regenerate-preintake-demos.js --run --id=LEAD_ID`
  - All 12 existing demos regenerated with updated template
- [x] **Email Analytics Dashboard** - `preintake/email-analytics.html`
  - Campaign performance tracking (visits, demo views, conversions)
  - Integrates with GA4 data
- [x] **Click Rate Analysis** - `scripts/analyze-click-rate.js`
  - Analyzes email campaign click-through rates

**New Files:**
| File | Purpose |
|------|---------|
| `scripts/regenerate-preintake-demos.js` | Regenerate demos with latest template |
| `preintake/email-analytics.html` | Campaign analytics dashboard |
| `scripts/analyze-click-rate.js` | Click rate analysis utility |

**sessionStorage Keys (Campaign Tracking):**
| Key | Purpose | Set By |
|-----|---------|--------|
| `tbp_demo_viewed` | Stores leadId when demo CTA clicked | `index.html` Campaign Hero CTA |

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

**Hero Messaging Evolution (Final):**
```
Before: "Screen Every Inquiry Before It Reaches Your Firm"
After:  "Pre-Screen Every Inquiry Before They Reach Your Firm"
        - "Pre-Screen" encodes "sits in front of CRMs" in one word
        - "They" (plural) works better than "It" for "Every Inquiry"
        - Industry-standard terminology in legal ops
        - Implies evaluation, not blocking
```

**Key Messaging Decisions (Phase 22):**
| Choice | Selected | Rationale |
|--------|----------|-----------|
| "Pre-Screen" vs "Screen" | Pre-Screen | Clarifies position (before staff), industry terminology |
| "They" vs "It" | They | Plural works better with "Every Inquiry" |
| Practice-area in subtitle | Yes | Core differentiator, deserves hero placement |
| "your firm's" vs "the firm's" | your firm's | More direct, personal tone |

- [x] **Email Campaign Share Line** - Added forward/share encouragement to outreach emails
  - "If you're not the right contact for intake, feel free to forward this email — the demo link above is specific to **${firmName}**."
  - Plain-text URL below for forwarded emails where button may not render
  - Only added to personalized demo template (not fallback template)
  - Rationale: Law firms are multi-stakeholder; first reader often isn't decision-maker

### Phase 23: Email & Homepage Messaging Alignment (2026-01-10)
- [x] **Homepage Metadata Fix** - Updated meta/OG/Twitter descriptions from "Screen" to "Pre-screen"
  - Lines 15, 26, 34 in `index.html` now consistent with hero H1 messaging
  - Ensures link previews match homepage positioning
- [x] **Email Subject Line Update** - Changed to "Pre-screen every inquiry before it reaches your team"
  - Aligns with homepage "Pre-Screen" terminology
  - Fallback email uses different subject: "We can build a custom intake demo for your firm"
- [x] **Email Header Rewrite** - Changed from "Practice-Specific AI Intake That Reviews and Qualifies Inquiries—24/7"
  - New header: "Pre-Screen Every Inquiry — Tailored to Your Practice Area"
  - Leads with core differentiator (pre-screening) + practice-area tailoring
- [x] **Email Body Restructure** - Reordered to lead with practice-area differentiation
  - Opens with: "Most intake tools treat every inquiry the same. PreIntake.ai is different..."
  - Emphasizes practice-area-specific questions and criteria
- [x] **Zero Data Retention Trust Signal** - Added to both email templates
  - Gold-accented styling matches homepage
  - "Inquiries are processed and delivered immediately, never stored on our servers."
- [x] **CTA Button Update** - Changed from "See How It Works" to "View Your Firm's Demo"
  - More personalized, matches demo link functionality
  - Fallback email keeps "Request Your Demo" button
- [x] **Preheader Alignment** - Updated inbox preview text
  - Personalized: "Pre-screen every inquiry before it reaches your team—see how it works for ${firmName}."
  - Fallback: "We can build a custom intake demo tailored specifically to ${firmName}."
- [x] **CAN-SPAM Compliance** - Added physical mailing address to email footer
  - "PreIntake.ai · 1543 Hamner Ave #247 · Norco, CA 92860"
  - Required for commercial email compliance
- [x] **Plain-Text Fallback** - Added `generateEmailPlainText()` and `generateFallbackEmailPlainText()` functions
  - Improves deliverability (some spam filters check for text version)
  - `sendEmail()` now sends multipart emails (HTML + plain-text)
- [x] **Template Version Update** - Changed from `v5-personalized-demo` to `v6-personalized-demo`
  - Tracks email template evolution for analytics

**Email Template v6 Changes Summary:**
| Element | Before | After |
|---------|--------|-------|
| Subject | "A smarter way to review intake inquiries before staff engagement" | "Pre-screen every inquiry before it reaches your team" |
| Header | "Practice-Specific AI Intake That Reviews and Qualifies Inquiries—24/7" | "Pre-Screen Every Inquiry — Tailored to Your Practice Area" |
| CTA Button | "See How It Works" | "View Your Firm's Demo" |
| Preheader | "How law firms reduce unqualified consultations without hiring more staff." | "Pre-screen every inquiry before it reaches your team—see how it works for ${firmName}." |
| Trust Signal | None | "Zero Data Retention — Inquiries are processed and delivered immediately, never stored on our servers." |
| Footer | URL + Unsubscribe only | URL + Physical Address + Unsubscribe |
| Format | HTML only | HTML + Plain-text multipart |

---

## Architecture

### Status Flow
```
pending → analyzing → researching → generating_demo → demo_ready
```

### File Structure

```
/preintake/
├── index.html              # Landing page with demo request form
├── create-account.html     # Account activation + Stripe checkout
├── payment-success.html    # Post-payment success page
├── about-us.html           # About us page
├── contact-us.html         # Contact form page
├── faq.html                # FAQ with accordion
├── email-analytics.html    # Campaign analytics dashboard
├── privacy-policy.html     # Privacy policy
├── terms-of-service.html   # Terms of service
├── sitemap.xml             # SEO sitemap (6 pages)
├── robots.txt              # Search engine directives
├── intake-button.js        # Embeddable floating button
├── widget.js               # Embeddable inline widget
├── EMBED-INSTRUCTIONS.md   # Client embed documentation
├── CLAUDE.md               # Project documentation
├── js/
│   └── components.js       # Shared header/footer (conditional Get Started button)
└── images/
    └── icon.svg            # Site icon/favicon (gold #c9a962)

/functions/
├── preintake-functions.js           # Form submission handler
├── preintake-analysis-functions.js  # Website analysis
├── deep-research-functions.js       # Multi-page scraping
├── demo-generator-functions.js      # Demo page generation
├── intake-delivery-functions.js     # Intake webhook + delivery
├── widget-functions.js              # Widget endpoints
├── stripe-functions.js              # Payment processing
└── templates/
    ├── demo-intake.html.template    # Demo intake template
    └── demo-config.js               # Demo config template

/scripts/
├── regenerate-preintake-demos.js    # Regenerate demos with latest template
├── analyze-click-rate.js            # Email click rate analysis
└── send-preintake-campaign.js       # Email campaign sender
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

### Demo Intake (`demo-intake.html.template`)
- Email validation in chat interface
- Phone validation (US and international)
- Typo detection and suggestions
- Fake domain blocking
- Session recovery with 24-hour TTL
- Deduplication (prevents duplicate submissions)

---

## Demo Generation Flow

1. **Lead submits form** → `submitDemoRequest` function
2. **Validation passes** → Store in Firestore with status `pending`
3. **Confirmation email** → Sent to prospect immediately
4. **New lead notification** → Sent to Stephen
5. **Analysis triggers** → `analyzePreIntakeLead` (Firestore onCreate)
6. **Website scraped** → Extract firm name, practice areas, branding
7. **Deep research runs** → `performDeepResearch`
8. **Additional pages scraped** → Attorneys, case results, testimonials
9. **Claude structures data** → Using Haiku for cost efficiency
10. **Demo generated** → `generatePreIntakeDemo` (Firestore onUpdate)
11. **HTML uploaded** → Firebase Storage at `preintake-demos/{leadId}/index.html`
12. **Demo ready emails** → Sent to BOTH prospect (`sendProspectDemoReadyEmail`) AND Stephen

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

### CRM Categories (Important Distinction)

Legal CRMs fall into two categories—mixing them up leads to bad product decisions:

| Category | Purpose | Examples |
|----------|---------|----------|
| **(A) Intake Conversion Engines** | Lead capture, screening, conversion | Lawmatics, Clio Grow, Law Ruler, Lead Docket |
| **(B) Relationship/BD CRMs** | Client relationships, business development | InterAction+, Salesforce (raw) |

**PreIntake.ai sits in front of Category A.** We're a gatekeeper, not a data janitor.

### Target CRMs (Prioritized by ROI)

**Tier 1 — Ship First** (removes #1 post-demo objection)

| CRM | Market | Why Priority | Integration Scope |
|-----|--------|--------------|-------------------|
| **Lawmatics** | Mid-size PI, Immigration, Family | Dominates intake; firms say it "collects junk but doesn't screen" | Create/Update Lead, GREEN/YELLOW/RED mapping, transcript |
| **Clio Grow** | Broad install base | Massive adoption, logo trust | New Lead, custom fields, calendar trigger for GREEN |
| **Filevine** | PI-heavy firms | Standard in PI; high willingness to pay | Create Lead → Project (conditional), notes + flags |

**Tier 2 — High-Volume PI** (prints money)

| CRM | Market | Why Priority |
|-----|--------|--------------|
| **Law Ruler** | Hardcore PI intake teams | Obsessive about speed; weak AI screening today |
| **SmartAdvocate** | Old-school PI | Deeply embedded; firms spend $50k+/mo on ads |

**Tier 3 — Enterprise/Platform** (build after revenue momentum)

| CRM | Notes |
|-----|-------|
| **Litify** | Salesforce underneath; longer sales cycles, compliance overhead |
| **Salesforce (raw)** | Rarely used directly by small firms; accessed through Litify |

**Tier 4 — Webhook Only** (let Zapier handle it)

| CRM | Notes |
|-----|-------|
| **HubSpot** | Generic; webhook + Zapier covers at near-zero cost |
| **Zoho** | Budget-focused; same approach |

### Chat/Lead Services (Potential Partners/Competitors)

| Service | Website | Notes |
|---------|---------|-------|
| Client Chat Live | clientchatlive.com | Live chat for law firms |
| Ngage Live Chat | ngagelive.com | 24/7 managed chat |
| ApexChat | apexchat.com | Legal chat widgets |
| Captorra | captorra.com | Lead management |
| Lead Docket | leaddocket.com | Legal intake + lead management (PI ecosystem) |
| SCORPION | scorpion.co | Full-service legal marketing |

### Integration Approach

**Current State (Phase 1)**
- Email delivery (default) ✅
- Webhook delivery (Zapier, custom integrations) ✅
- **This covers ~80% of buyers today**

**Future Phases (Revisit After 5+ Paying Customers Request Same CRM)**

| Phase | CRMs | Trigger |
|-------|------|---------|
| Phase 2 | Lawmatics, Clio Grow, Filevine | Repeated customer requests |
| Phase 3 | Law Ruler, SmartAdvocate | PI market expansion |
| Phase 4 | Litify | Enterprise demand |

**Build Criteria:**
- Don't build native integrations until 5+ paying customers ask for the same one
- Track which CRMs customers request in a simple tally
- Integrations should remove friction, not add feature bloat

*Last reviewed: 2025-12-31 (based on market analysis from legal-CRM rankings)*

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

| Gap | Current State | Planned Solution | Priority |
|-----|---------------|------------------|----------|
| Customer portal | None | Stripe Customer Portal integration | Medium |
| Analytics dashboard | None | Track demo engagement, conversion rates | Medium |
| CRM integrations | Email/webhook only (covers 80%) | Native integrations when 5+ customers request same CRM | Low (deferred) |
| Demo expiration | Demos persist indefinitely | Auto-delete after 30 days or on cancel | Low |
| Multi-language support | English only | Spanish, Chinese intake options | Low |
| A/B testing | None | Question flow optimization | Low |

---

## Technical Reference

### Key Cloud Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `submitDemoRequest` | HTTP | Handle demo request form submission |
| `analyzePreIntakeLead` | Firestore onCreate | Analyze website, trigger deep research |
| `generatePreIntakeDemo` | Firestore onUpdate | Generate demo intake page |
| `handleIntakeCompletion` | HTTP | Process completed intake, deliver lead |
| `getPreIntakeFirmStatus` | HTTP | Check subscription status for Demo/Live mode |
| `createCheckoutSession` | HTTP | Create Stripe checkout session |
| `getStripeConfig` | HTTP | Return publishable key and pricing |
| `stripeWebhook` | HTTP | Handle Stripe subscription events |
| `verifyCheckoutSession` | HTTP | Verify payment status |
| `serveDemo` | HTTP | Proxy demo HTML for CORS bypass |
| `getWidgetConfig` | HTTP | Return widget configuration |
| `intakeChat` | HTTP | AI chat endpoint |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/submitDemoRequest` | POST | Submit demo request |
| `/handleIntakeCompletion` | POST | Deliver completed intake |
| `/getPreIntakeFirmStatus` | GET | Check firm subscription status |
| `/createCheckoutSession` | POST | Create Stripe checkout |
| `/getStripeConfig` | GET | Get Stripe public config |
| `/stripeWebhook` | POST | Stripe webhook handler |
| `/verifyCheckoutSession` | GET | Verify checkout completion |
| `/demo/:firmId` | GET | Serve demo intake page |

### Firestore Collections (preintake database)

| Collection | Purpose |
|------------|---------|
| `preintake_leads` | Lead records with status, analysis, delivery config |
| `intake_dedup` | Deduplication records (leadId_email_phone) |
| `preintake_rate_limits` | IP rate limiting records |

### Firebase Storage

| Path | Purpose |
|------|---------|
| `preintake-demos/{leadId}/index.html` | Generated demo intake pages |

---

## Success Metrics

1. **Landing page**: Conversion rate from visitor → demo request
2. **Demo generator**: % of demos viewed after generation
3. **Sales pipeline**: Demo → sales call → signed customer
4. **Activation**: Payment → first embedded widget
5. **Retention**: Monthly churn rate
6. **Platform**: Practice areas supported, firms onboarded, intakes processed

---

## Contact

**Stephen Scott**
stephen@preintake.ai

---

**Bottom line:** PreIntake.ai reduces junk intakes and surfaces real cases faster—without replacing your CRM or changing how law firms practice law.
