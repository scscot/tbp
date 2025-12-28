# Plan: PreIntake.ai - Generalized Legal Intake Platform

**Last Updated**: 2025-12-28

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

### Phase 9: Account Creation & Payment (Future)
- [ ] Create `/preintake/create-account.html` page
- [ ] Account creation form (name, email, password)
- [ ] Delivery method selection (email, webhook, CRM)
- [ ] CRM credentials input for direct integrations
- [ ] Payment setup (setup fee + monthly subscription)
- [ ] Payment provider integration (TBD: Stripe, LawPay, etc.)

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
| Intake Button | `<script src="https://preintake.ai/intake-button.js" data-firm="ID"></script>` | Floating CTA on any page |
| Inline Widget | `<div id="preintake"></div><script src="https://preintake.ai/widget.js" data-firm="ID"></script>` | Dedicated contact page |
| Direct URL | `https://preintake.ai/demo/FIRM_ID` | Email links, QR codes |
| iframe | `<iframe src="https://preintake.ai/demo/FIRM_ID"></iframe>` | Maximum isolation |

**Programmatic Control:**
```javascript
PreIntake.open();   // Open intake modal
PreIntake.close();  // Close intake modal
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
├── intake-button.js        # Embeddable floating button script
├── widget.js               # Embeddable inline widget script
├── intake-button-test.html # Test page for intake button
├── EMBED-INSTRUCTIONS.md   # Client embed documentation
├── preintake.html          # Original PI intake page
├── preintake-config.js     # Config for preintake.html
├── preintake.md            # Pitch deck
└── PLAN.md                 # This file

/functions/
├── preintake-functions.js           # Form submission handler
├── preintake-analysis-functions.js  # Website analysis + triggers demo generation
├── deep-research-functions.js       # Multi-page website scraping
├── demo-generator-functions.js      # Demo page generation
├── intake-delivery-functions.js     # Intake completion webhook + delivery
├── widget-functions.js              # Widget endpoints (getWidgetConfig, intakeChat, serveDemo)
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

1. ~~**Deploy functions**~~ - ✅ Done (handleIntakeCompletion deployed)
2. **Test end-to-end flow** - Submit demo request, complete intake, verify email delivery
3. **Analytics dashboard** - Track demo engagement metrics
4. **Demo expiration** - Auto-delete demos after 30 days
5. **Account creation page** - Payment setup, delivery method selection (Phase 9)

---

## Success Metrics

1. **Landing page**: Conversion rate from visitor → demo request
2. **Demo generator**: % of demos viewed after generation
3. **Sales pipeline**: Demo → sales call → signed customer
4. **Platform**: Practice areas supported, firms onboarded, intakes processed
