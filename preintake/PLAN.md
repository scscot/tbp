# Plan: PreIntake.ai - Generalized Legal Intake Platform

**Last Updated**: 2025-12-29 (Phase 13: Session recovery, deduplication, additional comments, Demo/Live mode)

## Executive Summary

**Recommendation: YES - Broaden scope beyond PI/California**

Market research strongly supports generalizing the intake platform to serve any legal discipline nationwide. This positions preintake.ai as a horizontal legal tech platform rather than a niche California PI tool.

---

## Market Research Findings

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

## Strategic Recommendation

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
- [x] Copy this plan to `/preintake/PLAN.md` for project reference

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
- [x] Create demo intake template (`/functions/templates/demo-intake.html`)
- [x] Create demo config template (`/functions/templates/demo-config.js`)
- [x] Add email validation to demo intake chat interface
- [x] Configure Firebase Storage for demo hosting
- [x] Export functions in index.js

### Phase 5: Email Notifications
- [x] Demo confirmation email to prospect (on form submission)
- [x] New lead notification to Stephen (on form submission)
- [x] Demo ready notification to Stephen with demo URL

### Phase 6: Practice Area Templates
- [x] Personal Injury (existing, used as base)
- [x] Tax/IRS (existing)
- [x] Immigration (system prompt + button detection)
- [x] Family Law (system prompt + button detection)
- [x] Bankruptcy (system prompt + button detection)
- [x] Criminal Defense (system prompt + button detection)
- [x] Estate Planning (system prompt + button detection)

### Phase 7: Dynamic Practice Area Selection
- [x] After contact info collected, ask user to select their case type
- [x] Show buttons for each practice area from self-reported breakdown (landing page form)
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

**Benefits:**
- More relevant intake for multi-practice firms
- Better lead qualification (wrong practice area = disqualifier)
- Uses self-reported practice areas from landing page form (not website analysis)
- Single-practice firms skip the question (no friction)

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

**Delivery Options:**
| Method | Description | Status |
|--------|-------------|--------|
| Email | HTML summary to firm's intake address | ✅ Implemented |
| Webhook | POST JSON to custom URL | ✅ Implemented |
| CRM | Direct integration (Law Ruler, Filevine, etc.) | 🔮 Future |

**Key Principle:** PreIntake.ai does NOT retain client data. All intake information is immediately delivered and discarded.

### Phase 9: Account Creation & Payment
- [x] Create `/preintake/create-account.html` page
- [x] Create `/preintake/payment-success.html` page
- [x] Stripe integration (`stripe-functions.js`)
  - [x] `createCheckoutSession` - Creates Stripe Checkout session with setup fee + subscription
  - [x] `getStripeConfig` - Returns publishable key and pricing info
  - [x] `stripeWebhook` - Handles subscription events (with signature verification)
  - [x] `verifyCheckoutSession` - Verifies payment status (returns firmName, customerEmail)
- [x] Stripe webhook configured in Stripe Dashboard
- [x] Webhook signing secret stored as Firebase secret (`STRIPE_WEBHOOK_SECRET`)
- [x] Subscription status tracking in Firestore
- [x] Account activation email (customer + Stephen notification)
- [x] Payment success page refinements:
  - [x] Displays firm name instead of email in Account row
  - [x] Embed code includes `data-position="bottom-right"` with position options hint
  - [x] Shows lead delivery email in gold accent color
  - [x] Confetti animation on success
- [ ] Delivery method selection (email, webhook, CRM) - Future
- [ ] CRM credentials input for direct integrations - Future

**Pricing:**
| Item | Amount |
|------|--------|
| One-time Implementation Fee | $399 |
| Monthly Subscription | $129/mo |
| **Total Due Today** | **$528** |

**Account Activation Flow:**
```
Demo expires → /create-account.html?firm=ID → Stripe Checkout → /payment-success.html
```

**Stripe Webhook Events Handled:**
- `checkout.session.completed` - Marks account as active
- `customer.subscription.created/updated/deleted` - Tracks subscription status
- `invoice.payment_succeeded/failed` - Tracks payment status

**Stripe Configuration:**
- Webhook endpoint: `https://us-west1-teambuilder-plus-fe74d.cloudfunctions.net/stripeWebhook`
- Secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- Mode: Test (switch to live keys for production)

**Price IDs:**
| Environment | Implementation Fee | Monthly Subscription |
|-------------|-------------------|---------------------|
| **Test** | `price_1SjQ1aJaJO3EHqOSH5tYPJOB` | `price_1SjNpAJaJO3EHqOSHh4DbhNM` |
| **Live** | `price_1SjOXiJBdoLMDposfZXL8nZX` | `price_1SjORKJBdoLMDpos9wBBZbzd` |

**Note:** Test and live mode have separate price IDs. Update `stripe-functions.js` when switching modes.

### Phase 10: Embeddable Widget
- [x] Create `intake-button.js` - floating button that opens intake modal
- [x] Create `widget.js` - inline widget with Shadow DOM encapsulation
- [x] Create `serveDemo` Cloud Function to proxy demo HTML (CORS bypass for iframes)
- [x] Add `/demo/:firmId` URL rewrite in Firebase hosting
- [x] Support 6 button positions: bottom-right, bottom-left, bottom-center, top-right, top-left, top-center
- [x] Create `EMBED-INSTRUCTIONS.md` documentation
- [x] Create `intake-button-test.html` for testing

**Embed Options:**
| Option | Snippet | Use Case |
|--------|---------|----------|
| Intake Button | `<script src="https://preintake.ai/intake-button.js" data-firm="ID" data-position="bottom-right"></script>` | Floating CTA on any page |
| Inline Widget | `<div id="preintake"></div><script src="https://preintake.ai/widget.js" data-firm="ID"></script>` | Dedicated contact page |
| Direct URL | `https://preintake.ai/demo/FIRM_ID` | Email links, QR codes |
| iframe | `<iframe src="https://preintake.ai/demo/FIRM_ID"></iframe>` | Maximum isolation |

**Button Positions:** `bottom-right` (default), `bottom-left`, `bottom-center`, `top-right`, `top-left`, `top-center`

**Programmatic Control:**
```javascript
PreIntake.open();   // Open intake modal
PreIntake.close();  // Close intake modal
```

### Phase 11: Website Expansion
- [x] Create shared header/footer component (`/preintake/js/components.js`)
  - Header: PreIntake.ai text logo + hamburger menu (Home, About, Contact, FAQs)
  - Footer: Copyright, Privacy Policy, Terms of Service, Contact links
  - Self-initializing IIFE with DOM-ready detection
- [x] Update landing page (`/preintake/index.html`)
  - Added header/footer components
  - Added pricing section ($399 setup + $129/mo)
  - Added "Request Free Demo" callout section
- [x] Create About Us page (`/preintake/about-us.html`)
  - Company narrative and mission
  - Problem/solution messaging (60-70% unqualified leads)
  - Values grid (Practice-Specific, Privacy-Focused, Integrates, Conversational)
- [x] Create Contact Us page (`/preintake/contact-us.html`)
  - Contact form with mailto fallback
  - support@preintake.ai email
  - 24-hour response time commitment
- [x] Create FAQ page (`/preintake/faq.html`)
  - 8 questions with accordion functionality
  - Covers pricing, data retention, integrations, customization
- [x] Create Privacy Policy page (`/preintake/privacy-policy.html`)
  - Emphasizes no lead data retention
  - CCPA/GDPR compliance statements
  - Third-party services (Stripe, Claude AI, Firebase)
- [x] Create Terms of Service page (`/preintake/terms-of-service.html`)
  - 18 sections covering service, payments, liability
  - California governing law
- [x] Add data privacy language to intake page (`/preintake/preintake.html`)
  - "Your Data, Your Control" notice with shield icon
  - Green highlight box after disclaimer
- [x] Update payment success page with header/footer
- [x] Update create account page with header/footer

**Files Created:**
```
/preintake/
├── js/components.js        # Shared header/footer component
├── about-us.html           # About us page
├── contact-us.html         # Contact form page
├── faq.html                # FAQ with accordions
├── privacy-policy.html     # Privacy policy
└── terms-of-service.html   # Terms of service
```

**Files Modified:**
```
/preintake/
├── index.html              # Added header/footer, pricing, demo CTA
├── preintake.html          # Added data privacy notice
├── payment-success.html    # Added header/footer
└── create-account.html     # Added header/footer
```

### Phase 12: Enhanced Intake Email
- [x] Expand `complete_intake` tool schema with new fields:
  - `ai_screening_summary`: 2-3 sentence narrative summary of the case
  - `sol_status`: Object with status (within/near_expiration/expired), months_remaining, note
  - `injuries`: List of injuries (for PI cases)
  - `treatment_status`: Current medical treatment status
- [x] Update all 8 practice area prompts with `## When Calling collect_case_info` instructions
  - Claude now saves date_occurred and location fields when learned during intake
  - Personal Injury, Immigration, Family Law, Tax, Bankruptcy, Criminal Defense, Estate Planning, Generic
- [x] Add `formatTranscript()` function to demo template
  - Extracts readable conversation from `conversationHistory`
  - Formats as "Visitor: ..." / "Assistant: ..." dialogue
  - Removes internal [OPTIONS: ...] markers
- [x] Add full conversation transcript to webhook payload
- [x] Redesign email template (`generateIntakeSummary()`) to match homepage mockup:
  - AI Screening Summary section with gold left border
  - Case Details grid with SOL Status, Injuries, Treatment
  - SOL "Expired" displayed in red (#ef4444)
  - Full Conversation Transcript with styled Visitor/Assistant labels
  - XSS protection via `escapeHtml()` helper function

**Email Sections (Enhanced):**
```
1. Header - "New Intake Submission" + via PreIntake.ai
2. Qualification Badge - Green/Yellow/Red with confidence level
3. Contact Information - Name, Phone, Email
4. AI Screening Summary - 2-3 sentence narrative (gold left border)
5. Case Information - Case Type, Date Occurred, Location, SOL Status, Injuries, Treatment
6. Key Factors - Positive (green badges) and Negative (red badges)
7. Primary Strength/Concern - Yellow highlight box
8. Full Conversation Transcript - Complete dialogue with styled formatting
9. Footer - Timestamp + PreIntake.ai branding
```

**Files Modified:**
```
/functions/
├── demo-generator-functions.js     # Tool schema + practice area prompts
├── intake-delivery-functions.js    # Email template redesign
└── templates/
    └── demo-intake.html            # formatTranscript() + webhook payload
```

### Phase 13: Session Recovery, Deduplication & UX Enhancements
- [x] **Phone Number Validation** (`demo-intake.html`)
  - Validates US formats: `(555) 123-4567`, `555-123-4567`, `5551234567`, `+1 555 123 4567`
  - Validates international formats: `+44 20 7123 4567`, `+49 30 12345678`
  - Shows inline error messages with specific feedback (too short, too long, invalid format)
  - Added `isValidPhone()` and `showPhoneValidationError()` functions

- [x] **Email Header Simplification** (`intake-delivery-functions.js`)
  - Changed "AI Screening Summary" to "Screening Summary" in email template

- [x] **Demo vs Live Mode Display Logic** (`demo-intake.html`)
  - Added `getPreIntakeFirmStatus` Cloud Function to check `subscriptionStatus` at runtime
  - Demo Mode (`subscriptionStatus !== 'active'`): Shows PreIntake.ai promo after submission
  - Live Mode (`subscriptionStatus === 'active'`): Shows "Return to {firmName}" button with link to firm website
  - Bottom action buttons hidden in both modes post-submission

- [x] **Additional Comments Feature** (`demo-intake.html`, `intake-delivery-functions.js`)
  - GREEN/YELLOW qualified leads see "Is there anything else you'd like to add?" prompt
  - Yes → Shows textarea with 500-character limit and live counter
  - No → Proceeds directly to submission
  - RED routing skips additional comments (goes straight to decline screen)
  - Comments included in webhook payload and displayed in email with blue left border

- [x] **Multi-select Button Support** (`demo-generator-functions.js`, `demo-intake.html`)
  - AI can use `[OPTIONS-MULTI: Option 1 | Option 2 | Option 3]` for multi-select questions
  - Updated `parseAIOptions()` to detect `OPTIONS-MULTI:` prefix
  - Multi-select buttons show checkmarks when selected, allow multiple selections
  - Updated all practice area system prompts with multi-select documentation

- [x] **Deduplication** (`intake-delivery-functions.js`)
  - Prevents duplicate emails when same lead submits multiple times
  - Uses `intake_dedup` Firestore collection with key `{leadId}_{email}_{phone}`
  - Returns `{success: true, duplicate: true}` for duplicate submissions (no email sent)
  - Dedup record created before sending to prevent race conditions

- [x] **Session Recovery** (`demo-intake.html`)
  - Saves progress to localStorage after each data collection tool call
  - 24-hour TTL for saved sessions
  - On return: Shows "Continue Where You Left Off?" modal with user's name
  - Options: "Continue" (restores full conversation) or "Start Fresh"
  - Clears session on successful submission
  - Session key: `preintake_session_{LEAD_ID}` (per-firm sessions)

- [x] **Demo Mode Confirmation Modal** (`demo-intake.html`, `demo-generator-functions.js`)
  - After intake completion in Demo mode, shows confirmation modal
  - "Demo Intake Sent!" with green checkmark icon
  - "The intake lead has been sent to: {firmEmail}"
  - "Please check your inbox to see the lead notification email."
  - OK button to dismiss
  - Only shows when `firmStatus.isLiveMode === false`
  - Added `{{FIRM_EMAIL}}` placeholder to template system

**Data Flow Updates:**
```
Intake completes → Check dedup → Send webhook → Show loading → Show results
                                                              ↓
                                              Demo Mode: Show confirmation modal
                                              Live Mode: Show "Return to Firm" CTA
```

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

**Files Modified:**
```
/functions/
├── demo-generator-functions.js       # Multi-select prompts, FIRM_EMAIL placeholder
├── intake-delivery-functions.js      # Deduplication, "Screening Summary" header
├── preintake-functions.js            # getPreIntakeFirmStatus function
└── templates/
    └── demo-intake.html              # Session recovery, phone validation,
                                      # additional comments, confirmation modal,
                                      # Demo/Live mode display logic
```

---

## Architecture

```
Form Submission → Validate → Store Lead → Analyze Website → Deep Research → Generate Demo → Email URL
```

### Status Flow
`pending` → `analyzing` → `researching` → `generating_demo` → `demo_ready`

### Files Structure

```
/preintake/
├── index.html              # Landing page with demo request form
├── create-account.html     # Account activation + Stripe checkout page
├── payment-success.html    # Post-payment success page with embed instructions
├── about-us.html           # About us page
├── contact-us.html         # Contact form page
├── faq.html                # FAQ with accordion functionality
├── privacy-policy.html     # Privacy policy
├── terms-of-service.html   # Terms of service
├── intake-button.js        # Embeddable floating button script
├── widget.js               # Embeddable inline widget script
├── intake-button-test.html # Test page for intake button
├── EMBED-INSTRUCTIONS.md   # Client embed documentation
├── preintake.html          # Original PI intake page
├── preintake-config.js     # Config for preintake.html
├── preintake.md            # Pitch deck
├── PLAN.md                 # This file
└── js/
    └── components.js       # Shared header/footer component

/functions/
├── preintake-functions.js           # Form submission handler
├── preintake-analysis-functions.js  # Website analysis + triggers demo generation
├── deep-research-functions.js       # Multi-page website scraping
├── demo-generator-functions.js      # Demo page generation
├── intake-delivery-functions.js     # Intake completion webhook + delivery
├── widget-functions.js              # Widget endpoints (getWidgetConfig, intakeChat, serveDemo)
├── stripe-functions.js              # Stripe payment processing
└── templates/
    ├── demo-intake.html             # Demo intake template
    └── demo-config.js               # Demo config template
```

### Firebase Configuration
- **Hosting Target**: `preintake-ai` (serves `/preintake/` directory)
- **Domain**: preintake.ai
- **Firestore Database**: `preintake` (separate from main TBP database)
- **Storage Bucket**: `teambuilder-plus-fe74d.firebasestorage.app/preintake-demos/`

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

### Demo Intake (`demo-intake.html`)
- Email validation in chat interface
- Typo detection and suggestions
- Fake domain blocking

---

## Demo Generation Flow

1. **Lead submits form** → `submitDemoRequest` function
2. **Validation passes** → Store in Firestore with status `pending`
3. **Confirmation email** → Sent to prospect immediately
4. **New lead notification** → Sent to Stephen (stephen@preintake.ai)
5. **Analysis triggers** → `analyzePreIntakeLead` function (Firestore onCreate)
6. **Website scraped** → Extract firm name, practice areas, branding, contact info
7. **Deep research runs** → `performDeepResearch` function
8. **Additional pages scraped** → Attorneys, case results, testimonials
9. **Claude structures data** → Using Haiku for cost efficiency
10. **Demo generated** → `generatePreIntakeDemo` function (Firestore onUpdate)
11. **HTML uploaded** → Firebase Storage at `preintake-demos/{leadId}/index.html`
12. **Demo ready email** → Sent to Stephen with demo URL and firm details

---

## User Decisions (Confirmed)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Domain** | preintake.ai | Premium .ai domain acquired |
| **Database** | Separate Firestore | Isolation from TBP data |
| **Next Practice Area** | Immigration | Highest AI adoption (47%), complex intake |
| **MVP Scope** | Fully working demos | Auto-generate functional intake pages |
| **Demo Hosting** | Firebase Storage | `preintake-demos/{leadId}/index.html` |

---

## Next Steps

### Completed
1. ~~**Deploy functions**~~ - ✅ Done (handleIntakeCompletion deployed)
2. ~~**Account creation page**~~ - ✅ Done (Phase 9 complete with Stripe integration)
3. ~~**Test end-to-end payment flow**~~ - ✅ Done (2025-12-28, test card checkout successful)
4. ~~**Account activation email**~~ - ✅ Done (sends to customer + Stephen on checkout.session.completed)
5. ~~**Payment success page polish**~~ - ✅ Done (firm name, embed options, delivery email display)
6. ~~**Phase 13 UX enhancements**~~ - ✅ Done (2025-12-29)
   - Phone number validation (US + international formats)
   - Session recovery (24-hour localStorage with recovery modal)
   - Deduplication (prevents duplicate intake emails)
   - Additional comments feature (GREEN/YELLOW leads only)
   - Multi-select button support (`[OPTIONS-MULTI:]` format)
   - Demo/Live mode display logic (promo vs "Return to Firm")
   - Demo confirmation modal ("Intake sent to {email}")

### Scheduled Next Steps
7. **Deploy payment-success.html** - Deploy updated page to Firebase hosting
8. **Switch to Stripe live mode** - Replace test keys with live keys in `stripe-functions.js`
9. **End-to-end live test** - Complete a real payment with live credentials
10. **Lead delivery configuration** - Allow customers to configure delivery email/CRM/webhook
11. **Demo expiration** - Auto-delete demos after 30 days (or on subscription cancel)
12. **Customer portal** - Allow customers to manage subscription (Stripe Customer Portal)
13. **Analytics dashboard** - Track demo engagement metrics

---

## Lead Delivery Configuration

### Strategy: Default to Email, Upgrade Later

**Rationale:** Minimize friction at checkout. Get customers activated immediately, then offer CRM integration as a post-activation enhancement.

**Flow:**
```
1. Customer pays → Account activated → Leads delivered via EMAIL (default)
2. Welcome email includes: Embed code + "Configure CRM Integration" link
3. Customer can optionally set up CRM/webhook delivery later
4. For unsupported CRMs: Generic webhook or Zapier
```

**Benefits:**
- Zero friction at checkout (no config required)
- Customers start receiving leads immediately
- Learn which CRMs are actually requested before building integrations
- CRM setup can be self-service or assisted (premium)

### Delivery Methods

| Method | Description | Implementation |
|--------|-------------|----------------|
| **Email** (Default) | HTML summary to firm's intake email | ✅ Implemented |
| **Webhook** | POST JSON to custom URL (Zapier-compatible) | ✅ Implemented |
| **Native CRM** | Direct API integration | 🔮 Future |

### When to Configure

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| During checkout | Know what they're getting | Adds friction, complexity | ❌ |
| On payment-success | Captured the sale | May bounce, not complete | ❌ |
| Separate onboarding | Dedicated focus | Extra step, may skip | ⚠️ Optional |
| **Default to email** | Simplest, zero friction | May not meet all needs | ✅ **Recommended** |

---

## CRM Integration Research

### Target CRMs (Legal Practice Management)

| CRM | Website | API Status | Priority |
|-----|---------|------------|----------|
| **Law Ruler** | lawruler.com | Has API | High - PI-focused |
| **Filevine** | filevine.com | Has API | High - Popular |
| **SmartAdvocate** | smartadvocate.com | Has API | High - PI-focused |
| **Litify** | litify.com | Salesforce-based | Medium |
| **Needles** | portal.needles.com | Legacy | Medium |
| **TrialWorks** | assemblysoftware.com/trialworks | Has API | Medium |
| **CoCounselor** | cocounselor.com | Unknown | Low |

### Chat/Lead Services (Potential Partners/Competitors)

| Service | Website | Notes |
|---------|---------|-------|
| Client Chat Live | clientchatlive.com | Live chat for law firms |
| Ngage Live Chat | ngagelive.com | 24/7 managed chat |
| ApexChat | apexchat.com | Legal chat widgets |
| Captorra | captorra.com | Lead management |
| SCORPION | scorpion.co | Full-service legal marketing |

### Integration Approach

**Phase 1: Generic (Current)**
- Email delivery (default)
- Webhook delivery (Zapier, custom integrations)

**Phase 2: Popular CRMs**
- Law Ruler (PI firms)
- Filevine (multi-practice)
- SmartAdvocate (PI firms)

**Phase 3: Expand Based on Demand**
- Track which CRMs customers request
- Build integrations for top-requested systems

---

## Success Metrics

1. **Landing page**: Conversion rate from visitor → demo request
2. **Demo generator**: % of demos viewed after generation
3. **Sales pipeline**: Demo → sales call → signed customer
4. **Platform**: Practice areas supported, firms onboarded, intakes processed
