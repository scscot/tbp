# Team Build Pro - Comprehensive Knowledge Base

**Last Updated**: 2026-02-23
**Purpose**: Persistent knowledge base for AI assistants across sessions

---

## 🌐 Team Build Pro Ecosystem

The Team Build Pro ecosystem is a comprehensive, interconnected network of digital properties designed to drive app downloads and user acquisition. Each component serves a specific purpose in the customer journey, working together to convert prospects into paying subscribers.

### Ecosystem Components

| Property | URL | Purpose |
|----------|-----|---------|
| **Main Website (EN)** | https://teambuildpro.com | Primary landing page, SEO hub, conversion funnel |
| **Spanish Website** | https://es.teambuildpro.com | Spanish-speaking market acquisition |
| **Portuguese Website** | https://pt.teambuildpro.com | Brazilian/Portuguese market acquisition |
| **German Website** | https://de.teambuildpro.com | German-speaking market acquisition |
| **iOS App** | https://apps.apple.com/us/app/id6751211622 | iPhone/iPad distribution |
| **Android App** | https://play.google.com/store/apps/details?id=com.scott.ultimatefix | Android distribution |
| **Author Website** | https://www.stephenscott.us | Thought leadership, book sales, credibility |
| **Legacy Brand** | https://www.teambuildingproject.com | Historical brand, redirects to main site |

### Ecosystem Synergy & Conversion Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DISCOVERY CHANNELS                               │
├─────────────────────────────────────────────────────────────────────────┤
│  Email Campaigns → SEO/Blog → Social Media → Author Website → Referrals│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      WEBSITE ECOSYSTEM                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  teambuildpro.com ◄──► es.teambuildpro.com ◄──► pt.teambuildpro.com   │
│         │                      │                        │               │
│         └──────────────► de.teambuildpro.com ◄─────────┘               │
│         │                      │                        │               │
│    114 Company            Localized              Localized             │
│    Landing Pages       Content (ES/PT/DE)     Content (ES/PT/DE)      │
│         │                      │                        │               │
│    Blog (24 posts)        Blog (23-24 each)     Blog (23-24 each)     │
│         │                      │                        │               │
│    FAQ/Books              FAQ/Books              FAQ/Books             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        APP STORES                                       │
├─────────────────────────────────────────────────────────────────────────┤
│           iOS App Store  ◄──────────────────►  Google Play Store       │
│                          │                                             │
│                          ▼                                             │
│                   30-Day Free Trial                                    │
│                          │                                             │
│                          ▼                                             │
│                  $6.99/month Subscription                              │
└─────────────────────────────────────────────────────────────────────────┘
```

### How Each Component Drives Downloads

**1. Main Website (teambuildpro.com)**
- Primary SEO target with 114 company-specific landing pages
- Dynamic FAQ filtering for prospects vs professionals
- Blog content targeting "AI recruiting" and "direct sales" keywords
- Hero animation and CTA buttons directing to app stores
- Trust signals: privacy policy, terms, professional design

**2. Multilingual Websites (ES/PT/DE)**
- Capture Spanish, Portuguese, and German-speaking markets (Brazil, Latin America, Spain, Germany, Austria, Switzerland)
- Full content parity with English site
- Language-specific referral links from app share screen
- SEO-optimized with hreflang tags for international ranking

**3. Stephen Scott Author Website (stephenscott.us)**
- Establishes creator credibility through 13 published books
- Podcast presence builds thought leadership
- Cross-links to Team Build Pro app from book pages (especially AI/MLM books)
- Professional bio builds trust for app purchase decisions
- Dedicated blog with AI-powered content generation (`scripts/generate-sscott-blog.js`)
- Books like "How to Grow Your Network Marketing Business Using AI" link directly to Team Build Pro as the implementation tool
- Author website blog posts can reference and link to Team Build Pro features
- Bidirectional SEO benefit: author credibility boosts app trust, app success boosts author authority

**4. Company Landing Pages (114 pages EN/ES)**
- Target long-tail keywords: "AI recruiting for [Company Name]"
- Each page customized for specific direct sales companies
- Captures search traffic from professionals in specific companies
- All pages link to app store downloads

**5. Blog Content Strategy**
- Twice-weekly automated publishing (Mon/Thu)
- Topics: AI recruiting, direct sales best practices, industry trends
- Available in EN, ES, PT, DE for global reach (4 languages)
- Each post includes app download CTAs

**6. Email Campaign Integration**
- Three campaigns: Main (reduced, underperforming), Purchased (1.3K, primary focus), BFH (776, primary focus)
- Main Campaign reduced to 2/batch due to low click-through; focus shifted to BFH and Purchased campaigns
- Mailgun API via news.teambuildpro.com with Firestore send tracking
- Click tracking via GA4 UTM parameters (direct landing page URLs); open tracking disabled for deliverability
- Drives traffic to landing page → app downloads

**7. Legacy Brand (teambuildingproject.com)**
- Historical domain from earlier brand iteration
- Configured with redirects to teambuildpro.com
- Preserves any existing backlinks for SEO value

### Ecosystem Metrics & KPIs

| Metric | Current Value | Target |
|--------|---------------|--------|
| Email Click Rate | Tracked via GA4 UTM parameters | 3%+ |
| Email Open Rate | N/A (disabled for deliverability) | - |
| Website Languages | 4 (EN, ES, PT, DE) | 4 |
| Blog Posts (per language) | 23-24 | 25+ |
| Company Landing Pages | 114 (EN/ES) | 150+ |
| App Languages | 4 (EN, ES, PT, DE) | 4 |

### Cross-Linking Strategy

All ecosystem components are interconnected:
- **Website → App Stores**: Direct download links on every page
- **App → Websites**: Share screen generates language-specific referral URLs
- **Author Site → App**: Book pages link to Team Build Pro as the "tool that implements the strategies"
- **Author Site Blog → TBP Blog**: Topic coordination, cross-referencing for SEO authority
- **Email → Website → App**: Landing page routing for analytics and retargeting
- **Blog → App**: Every post includes "Get the App" CTA sections
- **Company Pages → App**: Tailored messaging for each company's audience

### Stephen Scott Author Site Integration

The stephenscott.us website serves as the credibility and thought leadership hub:
- **Book Catalog**: 13 books with 5 specifically about AI/MLM that reference Team Build Pro
- **MLM AI Book Series**: Available in English, Spanish, Portuguese, German, Hindi, Japanese
- **Blog**: Separate blog generation system (`scripts/generate-sscott-blog.js`) for author-specific content
- **Podcast Page**: Establishes authority through media appearances
- **Contact Integration**: Cloud Function (submitStephenScottContact) for lead capture
- **SEO Synergy**: Author domain authority supports Team Build Pro app credibility

---

## 🎯 Core Product Identity

### What is Team Build Pro?
**Team Build Pro is an AI Downline Builder** - a professional software tool (NOT a business opportunity or MLM company) that helps direct sales professionals build, manage, and track their downline before and during their business journey.

### Key Differentiator
The world's first AI-powered platform that lets **prospects pre-build their teams BEFORE joining a business opportunity**, creating momentum from Day 1 and eliminating the cold-start problem that causes 75% of recruits to quit in their first year.

---

## 📊 Critical Statistics

- **75% of recruits quit in their first year** (primary pain point)
- **16 pre-written messages** (8 for recruiting prospects + 8 for existing business partners)
- **24/7 AI Coach** for instant recruiting guidance in 4 languages
- **4 languages supported**: English, Spanish (Español), Portuguese (Português), German (Deutsch)
- **4 direct sponsors + 20 total downline members** = qualification milestones
- **120+ countries supported** with timezone-aware features
- **100+ direct sales companies** compatible
- **$6.99/month** after 30-day free trial
- **70% performance improvement** through client-side caching
- **10/10 mail-tester.com score** - SMTP email deliverability with SPF/DKIM/DMARC

---

## 🏗️ Technical Architecture

### Platform
- **Frontend**: Flutter (Dart) for iOS and Android
- **Backend**: Firebase (Firestore, Cloud Functions v2, Authentication, Remote Config)
- **Functions**: 104 Cloud Functions handling real-time operations
- **Hosting**: Firebase Hosting for web properties
- **Email**: Mailgun API (news.teambuildpro.com) for campaign delivery

### Key Directories
```
/Users/sscott/tbp/
├── lib/                    # Flutter app code
│   ├── screens/           # UI screens
│   ├── widgets/           # Reusable components
│   ├── services/          # Business logic (auth, IAP, network, FCM)
│   └── models/            # Data models
├── functions/             # Firebase Cloud Functions (Node.js)
├── scripts/               # Automation scripts
│   ├── generate-ai-blog.js  # AI blog generation (Claude CLI)
│   └── generate-blog.js     # Legacy blog generation
├── .github/workflows/     # GitHub Actions automation (25 workflows)
│   ├── weekly-blog.yml              # Twice-weekly blog automation (Mon/Thu 10am PST) + sitemap pings
│   ├── weekly-sscott-blog.yml       # Stephen Scott blog automation
│   ├── domain-warming-update.yml    # TBP/PreIntake domain warming batch sizes
│   ├── url-discovery.yml            # URL pattern discovery (every 2h, 120 companies/batch)
│   ├── contacts-scraper.yml         # Contact scraping (hourly, 400 URLs/batch)
│   └── preintake-*.yml / *bar-scraper.yml  # PreIntake workflows (see preintake/CLAUDE.md)
├── web/                   # Public website files (English)
│   ├── index.html        # Homepage
│   ├── faq.html          # FAQ with dynamic filtering
│   ├── books.html        # Books landing page
│   ├── companies/        # Company-specific recruiting guides (114 pages)
│   └── blog/             # Blog posts (24 articles)
├── web-es/                # Spanish website (es.teambuildpro.com)
│   ├── index.html        # Spanish homepage
│   ├── faq.html          # Spanish FAQ
│   ├── books.html        # Spanish books page
│   ├── blog/             # Spanish blog (24 translated posts)
│   ├── sitemap.xml       # Spanish sitemap
│   └── robots.txt        # Spanish search engine directives
├── web-pt/                # Portuguese website (pt.teambuildpro.com)
│   ├── index.html        # Portuguese homepage
│   ├── faq.html          # Portuguese FAQ
│   ├── books.html        # Portuguese books page
│   ├── blog/             # Portuguese blog (24 translated posts)
│   ├── sitemap.xml       # Portuguese sitemap
│   └── robots.txt        # Portuguese search engine directives
├── web-de/                # German website (de.teambuildpro.com)
│   ├── index.html        # German homepage (3x2 screenshot grid)
│   ├── faq.html          # German FAQ
│   ├── books.html        # German books page
│   ├── blog/             # German blog (23 translated posts)
│   ├── sitemap.xml       # German sitemap
│   └── robots.txt        # German search engine directives
├── sscott/                # Stephen Scott author website (stephenscott.us)
│   ├── public/           # Author site pages (migrated from Dreamhost to Firebase)
│   │   ├── index.html   # Author homepage
│   │   ├── books.html   # Author books catalog
│   │   ├── books/       # 13 individual book pages
│   │   ├── podcasts.html # Podcast listings
│   │   ├── blog.html    # Author blog index
│   │   └── blog/        # 19 blog posts (auto-generated weekly)
│   └── scripts/         # Build automation scripts
├── analytics/             # Analytics workspace (GA4)
│   ├── fetch-combined-analytics.js  # Combined reporting
│   ├── fetch-ga4-data.js           # Google Analytics 4 data
│   └── package.json                # Analytics dependencies
├── preintake/             # PreIntake.ai (separate product — see preintake/CLAUDE.md for details)
└── documents/            # Documentation and metadata
```

### Critical Systems

**1. Firebase UID Architecture**
- System uses Firebase UIDs throughout (NOT UUIDs)
- All `upline_refs` arrays contain Firebase UIDs
- Sponsor resolution converts referral codes to Firebase UIDs

**2. Subscription Management**
- iOS: App Store Server-to-Server notifications
- Android: Google Play Real-Time Developer Notifications
- States: trial, active, expired, cancelled, paused, on_hold
- Grace period handling for expired/cancelled states

**3. FCM Notification System**
- Three-tier token resolution (field → array[0] → subcollection)
- Milestone notifications with idempotent IDs
- Helper vs Trigger modes (environment variable controlled)

**4. Referral System**
- **Dedicated landing pages**: `prospects.html` and `professionals.html` exist in all 4 languages
  - These pages are blocked from search indexing via robots.txt (NOT in sitemaps)
  - NEVER delete these files - they are critical for referral flows
- `?new=ABC` = Prospect view: Routes to prospects.html or index.html with prospect-specific content
- `?ref=ABC` = Professional view: Routes to professionals.html or index.html with professional-specific content
- `index.html` also handles both views dynamically when accessed with query params
- Referral codes map to Firebase UIDs via `referralCodes` collection
- Language-specific domains: es.teambuildpro.com (Spanish), pt.teambuildpro.com (Portuguese), de.teambuildpro.com (German)
- Share screen uses language selection to route to appropriate domain

---

## 💬 Messaging & Positioning

### Value Propositions

**For Prospects** (people considering joining a business opportunity):
- Pre-build your team BEFORE investing
- Start Day 1 with momentum, not from zero
- Avoid the 75% first-year dropout fate
- Build confidence with AI-powered tools
- Risk-free 30-day trial

**For Professionals** (current direct sales people):
- Give prospects AI recruiting tools before they join YOUR business
- Eliminate cold-start failures
- True duplication with AI Coach for entire team
- Perpetual recruiting engine that feeds your organization
- Works with any direct sales company

### Key Messaging Points
1. **NOT pitching a business opportunity** - it's the tool that fuels the one you have
2. **Perpetual recruiting engine** - continues working after prospects join
3. **16 pre-written messages** eliminate "what do I say?" anxiety
4. **24/7 AI Coach** provides instant guidance
5. **Company-agnostic** - works with 100+ companies
6. **Pre-building eliminates cold starts** - the #1 reason people quit

### Language to Avoid
- ❌ "Proven" or "prove" (implies prospects must prove worthiness)
- ❌ "Two separate downlines" (it's ONE continuous downline)
- ❌ "90% quit rate" (accurate stat is 75%)
- ❌ Generic "AI system" (be specific: 16 messages + AI Coach)

---

## 🌐 Website Structure

### Multi-Language Website Architecture

#### Hosting Structure (5 TBP Sites + PreIntake)
- **English**: teambuildpro.com (web/) - Primary site
- **Spanish**: es.teambuildpro.com (web-es/) - Complete Spanish translation
- **Portuguese**: pt.teambuildpro.com (web-pt/) - Complete Portuguese translation
- **German**: de.teambuildpro.com (web-de/) - Complete German translation
- **Author**: stephenscott.us (sscott/) - Stephen Scott author website (migrated from Dreamhost)
- **Firebase Hosting**: Six targets total (main, es, pt, de, sscott, preintake-ai) — PreIntake is a separate product (see `preintake/CLAUDE.md`)

#### Language Switcher Implementation
- **Location**: Top-right of header on all pages
- **Functionality**: Switches between EN/ES/PT/DE versions
- **Query String Preservation**: Maintains `?new=` and `?ref=` parameters across language switches
- **Mobile Optimized**: Responsive positioning for all screen sizes
- **Smart Routing**: Directs to corresponding page in target language

#### Complete Content Parity (EN, ES, PT, DE)
All four main sites have identical structure:
- Homepage with hero animation
- FAQ page (8 questions)
- Books landing page with localized covers
- Blog index with 23-24 translated posts
- Privacy policy
- Terms of service
- Contact form
- Sitemap.xml for SEO
- Robots.txt for search engine directives

#### SEO Optimization
- **Hreflang Tags**: Cross-reference all language versions (EN/ES/PT/DE)
- **Localized Sitemaps**: Comprehensive page listing for each site
- **Robots.txt**: Custom directives per language
- **Meta Tags**: Language-specific titles and descriptions
- **Canonical URLs**: Proper canonical linking across languages

### Dynamic FAQ System (English site)
- **URL Parameter Detection**: `?new=` = Prospect view, otherwise = Professional view
- **Audience Filtering**: Uses `data-audience` attributes (prospect, professional, both)
- **Three Filter Systems**: Audience + Category dropdown + Search (unified)
- **SEO Optimization**: Dynamic meta tags based on audience type

### Key Pages (English - web/)
- `/` - Homepage with hero animation
- `/faq.html` - Dynamic FAQ (audience-aware, 8 questions)
- `/books.html` - Books landing page with AI/MLM book covers
- `/blog.html` - Blog index
- `/blog/` - 24 blog posts (auto-generated twice weekly via GitHub Actions)
- `/companies.html` - 114 company-specific recruiting guides
- `/companies/ai-recruiting-[company].html` - Individual company pages
- `/contact_us.html` - Contact form
- `/delete-account.html` - Account deletion (App Store requirement)
- `/privacy_policy.html` - Privacy policy
- `/terms_of_service.html` - Terms of service
- `/sitemap.xml` - Comprehensive sitemap
- `/robots.txt` - Search engine directives

### Spanish Site (web-es/ - es.teambuildpro.com)
- `/` - Spanish homepage with hero animation
- `/faq.html` - Spanish FAQ (8 questions with accordion)
- `/books.html` - Spanish books page (MLM-Cover-ES.jpg)
- `/blog.html` - Spanish blog index
- `/blog/` - 24 translated blog posts (same titles as EN)
- `/companies.html` - Company recruiting guides index (114 companies with pagination)
- `/companies/` - 114 company-specific recruiting guides in Spanish
- `/contact_us.html` - Spanish contact form
- `/privacy_policy.html` - Spanish privacy policy
- `/terms_of_service.html` - Spanish terms of service
- `/sitemap.xml` - Spanish sitemap with hreflang tags (includes all company pages)
- `/robots.txt` - Spanish search directives

### Portuguese Site (web-pt/ - pt.teambuildpro.com)
- `/` - Portuguese homepage with hero animation
- `/faq.html` - Portuguese FAQ (8 questions with accordion)
- `/books.html` - Portuguese books page (MLM-Cover-BR.jpg)
- `/blog.html` - Portuguese blog index
- `/blog/` - 24 translated blog posts (same titles as EN)
- `/companies.html` - Company recruiting guides index (39 companies with pagination)
- `/companies/` - 39 company-specific recruiting guides in Portuguese
- `/contact_us.html` - Portuguese contact form
- `/privacy_policy.html` - Portuguese privacy policy
- `/terms_of_service.html` - Portuguese terms of service
- `/sitemap.xml` - Portuguese sitemap with hreflang tags (includes all company pages)
- `/robots.txt` - Portuguese search directives

### German Site (web-de/ - de.teambuildpro.com)
- `/` - German homepage with hero animation (3x2 screenshot grid layout)
- `/faq.html` - German FAQ (8 questions with accordion)
- `/books.html` - German books page (MLM-Cover-DE.jpg)
- `/blog.html` - German blog index
- `/blog/` - 23 translated blog posts (same titles as EN)
- `/companies.html` - Company recruiting guides index (20 companies with pagination)
- `/companies/` - 20 company-specific recruiting guides in German
- `/contact_us.html` - German contact form
- `/claim.html` - German claim/verification page
- `/privacy_policy.html` - German privacy policy (Datenschutzrichtlinie)
- `/terms_of_service.html` - German terms of service (Nutzungsbedingungen)
- `/sitemap.xml` - German sitemap with hreflang tags (includes all company pages)
- `/robots.txt` - German search directives

### Stephen Scott Author Website (sscott/ - stephenscott.us)
- `/` - Author homepage (professional portfolio)
- `/about.html` - About Stephen Scott (253 lines)
- `/books.html` - Author books catalog (13 books)
- `/books/[book-slug].html` - Individual book pages:
  - ai-beginners-guide-2024-2025.html
  - ai-your-gateway-to-a-better-life.html
  - breaking-through-barriers.html
  - divine-conversations.html
  - grow-your-network-marketing-business-using-ai.html
  - mlm-ai-espanol.html, mlm-ai-german.html, mlm-ai-hindi.html, mlm-ai-japanese.html, mlm-ai-portugues.html
  - stop-sabotaging-your-life.html
  - the-art-of-mastering-fear-and-uncertainty.html
  - thrive-within.html
- `/podcasts.html` - Podcast listings (425 lines)
- `/blog.html` - Author blog index
- `/contact.html` - Author contact form (Cloud Function: submitStephenScottContact)
- `/404.html` - Custom error page
- `/sitemap.xml` - Author site sitemap (122 lines)

### SEO & Meta Tags
- Title: "AI Downline Builder - Recruit Smarter, Build Faster"
- Description: "Recruit smarter & empower your downline with AI. Pre-written messages, 24/7 coaching, real-time tracking. Free 30-day trial. $6.99/mo after."
- Focus keywords: AI downline builder, pre-build teams, direct sales recruiting

---

## 🤖 Bot Detection & Traffic Analysis

### Comprehensive Bot Filtering System
- **Implementation**: JavaScript bot detection across all sites (EN, ES, PT, DE, Author)
- **Detection Method**: Browser fingerprinting, behavior analysis, known bot signatures
- **Scripts**: add-bot-detection.js, fix-bot-detection.js deployed site-wide
- **Purpose**: Filter bot traffic from analytics for accurate user metrics

### Traffic Analysis Tools

**analyze-boardman-traffic.js** (169 lines)
- Investigates suspicious traffic from Boardman, OR
- Browser/OS fingerprinting analysis
- Pattern detection for bot identification
- GA4 integration for comprehensive reporting

**analyze-city-traffic.js** (217 lines)
- General city-level traffic monitoring
- Traffic quality assessment
- Anomaly detection across geographic regions
- Identifies patterns of automated access

### Integration
- Bot detection runs on page load
- Flags bot traffic before analytics tracking
- Preserves clean user metrics in GA4
- Continuously updated bot signature database

---

## 📊 Analytics Infrastructure

### Analytics Workspace (analytics/ directory)
- **Purpose**: Separate npm workspace for analytics tools
- **Dependencies**: Google Analytics Data API v1
- **Environment**: Service account authentication (ga4-service-account.json)

### Analytics Dashboards (Web)

**TBP Analytics Dashboard** (`web/TBP-analytics.html` + `functions/analytics-dashboard-functions.js`)
- Password-protected dashboard at `/TBP-analytics.html`
- Three tabs: Website (GA4), iOS App Store, Android Play Store
- **Website tab**: GA4 metrics (users, sessions, engagement, traffic sources, top pages, top countries, device/domain breakdown)
- **Date range selector**: Today, Yesterday, 7 Days, 30 Days options
- **Email Campaign section**: Six campaign cards (Main/Purchased/BFH/Paparazzi/FSR/Zinzino) showing sent/remaining
  - Removed Contacts Campaign from dashboard (Feb 14, 2026 - campaign complete)
  - Each campaign card shows Firestore send stats; click tracking moved to GA4
  - Clicks tracked via GA4 UTM parameters in direct landing page URLs
- **iOS tab**: App Store Connect metrics (downloads, impressions, reviews, versions)
- **Android tab**: Google Play metrics from GCS bucket + CSV import fallback
- AI-generated observations via OpenAI
- Backend: `getTBPAnalytics` Cloud Function combining GA4, App Store Connect, Google Play, and Firestore data

**Email Stats Dashboard** (`web/email-stats.html` + `functions/email-stats-functions.js`)
- Password-protected dashboard at `/email-stats.html`
- **Data sources**: Firestore (send tracking) + GA4 (click tracking via `sessionMedium: 'email'`)
- **Tracking**: Sends tracked via Firestore; clicks tracked via GA4 UTM parameters; open tracking disabled
- **Metrics**: Campaign progress (sent/remaining/failed), A/B test subject line breakdown
- **A/B test tags**: Main campaign: `main_v9a`, `main_v9b`, `main_v10a`, `main_v10b` (4-way V9/V10 test); Contacts: `mobile_first_v7`, `mobile_first_v8`; legacy tags supported for historical data
- Backend: `getEmailCampaignStats` Cloud Function

### Core Analytics Scripts

**fetch-combined-analytics.js** (511 lines)
- Combined GA4 + email campaign reporting system
- Cross-references website traffic with email campaign performance
- Generates comprehensive analytics reports

**fetch-ga4-data.js** (384 lines)
- Google Analytics 4 data extraction
- Automated report generation
- Traffic source analysis
- User behavior metrics
- Conversion tracking

**count-unsent-emails.js** (33 lines)
- Email campaign queue monitoring
- Real-time unsent email counts
- Campaign progress tracking

### Reporting Capabilities
- Daily/weekly/monthly traffic reports
- Email campaign performance metrics (Firestore-based)
- Geographic traffic distribution
- User engagement analysis
- Conversion funnel tracking
- Bot vs. human traffic differentiation

---

## 📱 App Store Listing

**App Name**: Team Build Pro: Direct Sales
**App ID (iOS)**: 6751211622
**Package ID (Android)**: com.scott.ultimatefix
**Status**: LIVE on both iOS App Store and Google Play Store (as of Nov 2025)

### App Store URLs
- **iOS**: https://apps.apple.com/us/app/id6751211622 (simplified URL without app name slug)
- **Android**: https://play.google.com/store/apps/details?id=com.scott.ultimatefix
- **Website**: https://teambuildpro.com

### Key Features (as listed)
1. AI-Powered Recruiting Coach
2. 16 Pre-Written Messages (8 for prospects + 8 for partners)
3. Downline Qualification Tracking
4. Secure Team Messaging
5. Real-Time Analytics
6. Company-Agnostic Platform

---

## 🔧 Development Workflow

### Flutter Commands
```bash
flutter run --release          # Run release build
flutter build ios --release    # Build iOS release
flutter build appbundle        # Build Android App Bundle
flutter clean                  # Clean build cache
```

### Firebase Commands
```bash
firebase deploy --only hosting              # Deploy website
firebase deploy --only functions           # Deploy Cloud Functions
firebase emulators:start                   # Start local emulators
firebase functions:log                     # View function logs
```

### Git Workflow
```bash
git add . && git commit -m "message" && git push
```

---

## 📧 Email Campaigns

### Campaign Architecture Overview

The email campaign system consists of multiple parallel campaigns targeting different audience segments, using Mailgun API with Firestore send tracking and GA4 click tracking via UTM parameters.

**Email Configuration:**
- **Sending Domain**: `news.teambuildpro.com`
- **From**: `Stephen Scott <stephen@news.teambuildpro.com>`
- **Template**: Mailgun-hosted 'mailer' template with v9/v10 as primary versions (personal note style)
  - V9: Statistical hook ("75% of new reps quit") + systems problem framing
  - V10: Credentials hook ("After 20+ years in tech and direct sales") + pattern observation
  - V9-es/V10-es: Spanish translations, V9-de/V10-de: German translations
  - V11/V12: Deprecated (were personalized_intro variants, now consolidated into v9/v10)
- **Main Campaign A/B Test** (4-way): V9/V10 templates × 2 subject lines
  - V9a: V9 template + "AI is changing how teams grow"
  - V9b: V9 template + "Your AI-powered recruiting assistant"
  - V10a: V10 template + "AI is changing how teams grow"
  - V10b: V10 template + "Your AI-powered recruiting assistant"
  - Tags: `main_v9a`, `main_v9b`, `main_v10a`, `main_v10b`
  - **Note**: Subject "Not an opportunity. Just a tool." triggers Gmail spam filter - REMOVED Feb 23, 2026
- **Contacts Campaign A/B Test**: V7/V8 (legacy - `mobile_first_v7` / `mobile_first_v8`)
- **Tracking**: Click tracking via GA4 UTM parameters in direct landing page URLs; open tracking disabled (pixel removed for deliverability)
- **DNS**: SPF + DKIM + DMARC configured for 10/10 mail-tester.com score
- **Mailgun Credentials**: `functions/.env.teambuilder-plus-fe74d` (TBP_MAILGUN_* variables)

### Main Campaign (Mailgun API - REDUCED)
- **Status**: REDUCED (Feb 18, 2026) - Underperforming click-through rates; focus shifted to BFH and Purchased campaigns
- **Function**: `sendHourlyEmailCampaign` in `functions/email-campaign-functions.js`
- **Tags**: `tbp_campaign`, `tracked`
- **Schedule**: 8am, 11am, 2pm, 5pm PT (4 runs/day)
- **Data Source**: Firestore `emailCampaigns/master/contacts` collection
- **Control Variable**: EMAIL_CAMPAIGN_ENABLED
- **Batch Size**: 2 (reduced from 50 via Firestore `config/emailCampaign.batchSize`)
- **Domain Warming**: Automated via `.github/workflows/domain-warming-update.yml`

### Contacts Campaign (PAUSED - Complete)
- **Function**: `sendHourlyContactsCampaign` in `functions/email-campaign-contacts.js`
- **Status**: PAUSED - Collection cleaned (826 contacts after Feb 15 corporate email cleanup)
- **Tags**: `contacts_campaign`, `tracked`
- **Schedule**: 9am, 12pm, 3pm, 6pm PT (4 runs/day, staggered 1hr after Main)
- **Data Source**: Firestore `direct_sales_contacts` collection
- **Control Variable**: CONTACTS_CAMPAIGN_ENABLED (separate from Main)
- **Batch Size**: 0 (paused via `config/emailCampaign.batchSizeContacts`)
- **Subject**: V7/V8 A/B test (legacy `mobile_first_v7` / `mobile_first_v8`)
- **Template Variables**: `first_name`, `company`, `tracked_cta_url`, `unsubscribe_url`

### Yahoo Campaign (REMOVED - Jan 2026)
- **Status**: REMOVED - File and function deleted
- **Purpose**: Was separate campaign for Yahoo/AOL email addresses
- **Data Source**: Was Firestore `emailCampaigns/master/contacts_yahoo` collection

### BFH Campaign (Mailgun API - Automated)
- **Function**: `sendHourlyBfhCampaign` in `functions/email-campaign-bfh.js`
- **Tags**: `bfh_campaign`, `tracked`
- **Schedule**: 10am, 1pm, 4pm, 7pm PT (4 runs/day, staggered from Main and Contacts)
- **Data Source**: Firestore `bfh_contacts` collection
- **Control Variable**: BFH_CAMPAIGN_ENABLED
- **Batch Size**: Dynamic via Firestore `config/emailCampaign.batchSizeBfh` (or falls back to shared `batchSize`)
- **Subject**: V9/V10 A/B test with 4-way rotation (`bfh_v9a`, `bfh_v9b`, `bfh_v10a`, `bfh_v10b`)
- **Query**: `bfhScraped == true && emailSearched == true && email != null && sent == false`
- **Template Variables**: `first_name`, `tracked_cta_url`, `unsubscribe_url`
- **Scripts**:
  - `scripts/bfh-scraper.js` - Phase 1: Scrape BFH profile pages (name, company, country, Facebook/website URLs)
  - `scripts/bfh-email-search.js` - Phase 2: Google search for public email addresses

### FSR Campaign (Mailgun API - Automated)
- **Function**: `sendFsrContactsCampaign` in `functions/email-campaign-fsr.js`
- **Tags**: `fsr_campaign`, `tracked`
- **Schedule**: 10am, 1pm, 4pm, 7pm PT (4 runs/day, same as BFH)
- **Data Source**: Firestore `fsr_contacts` collection (scraped from findsalesrep.com)
- **Control Variable**: FSR_CAMPAIGN_ENABLED
- **Batch Size**: Dynamic via Firestore `config/emailCampaign.batchSizeFsr`
- **Subject**: V9/V10 A/B test with 2-way rotation (`fsr_v9a`, `fsr_v10a`)
  - V9a: "AI is changing how teams grow"
  - V10a: "Your AI-powered recruiting assistant"
- **Query**: `sent == false && email != null`, ordered by randomIndex
- **Template Variables**: `first_name`, `tracked_cta_url`, `unsubscribe_url`

### Paparazzi Campaign (Mailgun API - Automated)
- **Function**: `sendHourlyPaparazziCampaign` in `functions/email-campaign-paparazzi.js`
- **Tags**: `paparazzi_campaign`, `tracked`
- **Schedule**: 10:30am, 1:30pm, 4:30pm, 7:30pm PT (4 runs/day)
- **Data Source**: Firestore `paparazzi_contacts` collection (scraped from Paparazzi distributor pages)
- **Control Variable**: PAPARAZZI_CAMPAIGN_ENABLED
- **Batch Size**: Dynamic via Firestore `config/emailCampaign.batchSizePaparazzi`
- **Subject**: V9/V10 A/B test with 4-way rotation (`paparazzi_v9a`, `paparazzi_v9b`, `paparazzi_v10a`, `paparazzi_v10b`)
  - V9a: "AI is changing how teams grow"
  - V9b: "Your AI-powered recruiting assistant"
  - V10a: "AI is changing how teams grow"
  - V10b: "Your AI-powered recruiting assistant"
- **Query**: `sent == false && email != null`, ordered by randomIndex
- **Template Variables**: `first_name`, `tracked_cta_url`, `unsubscribe_url`
- **Test Endpoint**: `testPaparazziEmail` - HTTP endpoint for spam monitoring workflow

- **Two-Script Architecture** (Feb 2026):
  - `scripts/fsr-id-harvester.js` - Fast ID harvester (no CAPTCHA, 12x daily, 50 pages/run)
  - `scripts/fsr-scraper.js` - Contact scraper with 2Captcha reCAPTCHA solver (4x daily, 75/run)

### Batch Size Configuration
- **Firestore Config**: `config/emailCampaign` document stores batch sizes per campaign
- **Current Settings** (updated Feb 19, 2026 - FSR campaign added):
  | Campaign | Batch Size | Runs/Day | Emails/Day | Collection Size | Status |
  |----------|------------|----------|------------|-----------------|--------|
  | Main (`batchSize`) | 2 | 4 | 8 | ~17,900 | Reduced (underperforming) |
  | Purchased (`batchSizePurchased`) | 15 | 4 | 60 | 1,402 | **Primary focus** |
  | BFH (`batchSizeBfh`) | 10 | 4 | 40 | 776 | **Primary focus** |
  | FSR (`batchSizeFsr`) | 5 | 4 | 20 | 17 | New (Feb 19) |
  | Paparazzi (`batchSizePaparazzi`) | TBD | 4 | TBD | TBD | New (Feb 23) |
  | Contacts (`batchSizeContacts`) | 0 | - | - | 826 (paused) | Complete |
  | **Total** | - | 20 | **TBD** | - | - |

### Automated Domain Warming System
- **Workflow**: `.github/workflows/domain-warming-update.yml`
- **Config**: `.github/warming-config.json`
- **Schedule**: Runs every Monday at 6am PT
- **Mechanism**: GitHub Actions calculates current week, looks up batch size from config, updates Firestore
- **PreIntake Warming Schedule** (reset 2026-02-09, 4 runs/day Mon-Fri):
  | Week | Batch Size | Emails/Day |
  |------|------------|------------|
  | 1 | 100 | 400 |
  | 2 | 150 | 600 |
  | 3 | 225 | 900 |
  | 4+ | 300 | 1,200 |
- **Manual Override**: `workflow_dispatch` with `force_week` input to test specific week

### Campaign Tracking
- **Sent/Failed/Remaining**: Tracked in Firestore (sent, status fields per collection)
- **Click Tracking**: GA4 via UTM parameters in direct landing page URLs (utm_source=mailgun, utm_medium=email, utm_campaign, utm_content)
- **Open Tracking**: Disabled (tracking pixel removed for deliverability)
- **GA4 Campaign Traffic**: Filtered by `sessionMedium: 'email'`
- **A/B Test Breakdown**: By `subjectTag` field - Main: `main_v9a`, `main_v9b`, `main_v10a`, `main_v10b`; Contacts: `mobile_first_v7`, `mobile_first_v8`
- **Dashboards**: `email-stats.html` (email-focused) and `TBP-analytics.html` (unified analytics with GA4 click tracking)

### Android Launch Campaign (REMOVED - Jan 2026)
- **Status**: REMOVED - Function and all references deleted
- **Purpose**: Was for re-engaging contacts sent before Nov 12, 2025 Android launch

### Mailgun Event Sync (Legacy - Disabled)
- **Function**: `syncMailgunEvents` in `functions/email-campaign-functions.js`
- **Purpose**: Was used to sync Mailgun delivery/engagement data to Firestore before 24-hour log expiration
- **Status**: Disabled after SMTP migration (Jan 2026). Mailgun open/click tracking also disabled.
- **Current tracking**: GA4 via UTM parameters in direct landing page URLs

### Launch Campaign (Mailgun - Manual Trigger)
- **Function**: `sendLaunchCampaign` in `functions/sendLaunchCampaign.js`
- **Template**: `launch_campaign_mailgun.html` (simple, personal style)
- **Trigger**: HTTP POST endpoint (manual execution)
- **Data Source**: Firestore `launch_notifications` collection
- **Purpose**: One-time announcement emails to landing page signups
- **Status**: Converted from SendGrid to Mailgun (Nov 2025)

### Email Strategy Decisions
1. **Landing Page CTA** (not direct app store links):
   - Works on all devices (desktop/mobile)
   - Enables retargeting and analytics
   - Provides social proof and trust building
   - Better for cold email to MLM professionals

2. **Subtle Text Links** (not buttons):
   - Less "markety" for pitch-fatigued MLM audience
   - Builds trust through restraint
   - Stands out by NOT looking promotional
   - High deliverability with 10/10 mail-tester.com score

3. **Personal, Simple Style**:
   - No complex hero images or heavy formatting
   - Personal tone from Stephen Scott
   - Focus on value and benefits
   - System sans-serif font, 16px body, left-aligned (not centered)
   - Inline CTA link (not button): "take a look here: teambuildpro.com"

### Target Audience
- Current direct sales professionals (not prospects)
- Cold email list sourced from MLM/direct sales databases
- Goal: Landing page visits → App downloads → Trial sign-ups → Paid conversions

---

## 🔗 Contacts Discovery Pipeline

### Pipeline Overview
Automated 4-stage pipeline that discovers direct sales distributor URLs, scrapes contact info, and feeds the email campaigns.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Stage 1: Company Discovery                                         │
│  scripts/scrape-bfh-companies.js → base_urls.txt (1,082 companies) │
│  Source: BusinessForHome.org sitemap (~710 companies)               │
│  Manual run, appends new company domains                            │
├──────────────────────────────────────────────────────────────────────┤
│  Stage 2: URL Pattern Discovery                                     │
│  scripts/base_url_discovery.js → patterns.json                      │
│  Source: Common Crawl Index (5 indexes)                             │
│  Schedule: Every 2 hours, 120 companies/batch (GitHub Actions)      │
│  Discovers subdomain/path patterns for distributor pages            │
├──────────────────────────────────────────────────────────────────────┤
│  Stage 3: Distributor URL Seeding                                   │
│  scripts/seed-contacts-urls.js → Firestore direct_sales_contacts   │
│  Sources: Common Crawl (17 indexes) + Wayback Machine + crt.sh     │
│  Schedule: Every 4 hours, 40 companies/batch (GitHub Actions)       │
│  Queries web indexes for actual distributor page URLs               │
├──────────────────────────────────────────────────────────────────────┤
│  Stage 4: Contact Scraping                                          │
│  scripts/contacts-scraper.js → Firestore direct_sales_contacts     │
│  Schedule: Hourly, 400 URLs/batch (GitHub Actions)                  │
│  Puppeteer-based scraping for emails/phones on distributor pages    │
│  Blocked platforms tracked in config/contactsScraper                │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              Contacts Campaign (email-campaign-contacts.js)
              Sends company-specific emails to scraped contacts
```

### Key Scripts

| Script | Purpose | Schedule |
|--------|---------|----------|
| `scrape-bfh-companies.js` | Discover new MLM companies from BFH | Manual |
| `base_url_discovery.js` | Find distributor URL patterns via Common Crawl | Every 2h (120/batch) |
| `seed-contacts-urls.js` | Seed distributor URLs from 3 web indexes | Every 4h (40/batch) |
| `contacts-scraper.js` | Scrape contact info from distributor pages | Hourly (400/batch) |

### Key Files
- `scripts/base_urls.txt` — Master list of 1,082 MLM company domains
- `scripts/patterns.json` — Discovered URL patterns per company (subdomain/path/third-party/unknown/inactive)
- Firestore `direct_sales_contacts` — Scraped contacts with email, phone, company, URL
- Firestore `config/contactsScraper` — Blocked platforms and scraper config

### Data Sources for URL Discovery (seed-contacts-urls.js)
1. **Common Crawl Index API** — 17 indexes (2024-2026), JSONL format, free, 1.5s delay
2. **Wayback Machine CDX API** — Internet Archive historical URLs, free, no key required
3. **Certificate Transparency (crt.sh)** — SSL cert logs for subdomain discovery, free

### BFH (Business For Home) Data Pipeline

**Current Collection**: 886 contacts (after Feb 15 corporate email cleanup)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Stage 1: Profile URL Seeding                                        │
│  scripts/bfh-scraper.js --seed                                       │
│  Source: businessforhome.org/momentum-ranks/recommended-distributors │
│  ~709 distributors across 36 pages → Firestore bfh_contacts          │
│                                                                      │
│  Additional Source: MLM500 Rankings                                  │
│  scripts/mlm500-scraper.js --migrate-to-bfh                          │
│  ~583 contacts migrated from mlm500_staging (Feb 14, 2026)           │
├──────────────────────────────────────────────────────────────────────┤
│  Stage 2: Profile Scraping                                           │
│  scripts/bfh-scraper.js --scrape                                     │
│  Extracts: name, company, country, Facebook URL, website URL         │
│  Updates bfh_contacts with bfhScraped: true                          │
├──────────────────────────────────────────────────────────────────────┤
│  Stage 3: Email Discovery (Google Search)                            │
│  scripts/bfh-email-search.js --search                                │
│  Query: "{name}" "{company}" email                                   │
│  Rate limited: 4-6 seconds between searches                          │
│  Expected yield: 10-30% of contacts                                  │
│  Updates bfh_contacts with email, emailSearched: true                │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              BFH Campaign (email-campaign-bfh.js)
              Schedule: 10am, 1pm, 4pm, 7pm PT
              V9/V10 A/B test with 4-way rotation
```

### BFH Collection Schema: `bfh_contacts`

```javascript
{
  // Core fields
  firstName: string,
  lastName: string,
  fullName: string,
  email: string | null,        // Found via Google search
  company: string,
  country: string,

  // Source URLs
  bfhProfileUrl: string,       // Business For Home profile
  facebookUrl: string | null,  // Facebook profile link
  websiteUrl: string | null,   // Personal/company website
  slug: string,                // URL slug from BFH profile

  // Scraping status
  bfhScraped: boolean,         // BFH profile scraped
  bfhScrapedAt: timestamp,
  emailSearched: boolean,      // Google search performed
  emailSearchedAt: timestamp,
  emailSource: string,         // 'serpapi' or null

  // Profile enrichment fields (Phase 1)
  profileBio: string | null,        // Bio/description from profile
  reviewSnippets: string[],         // Up to 3 review excerpts
  reviewCount: number,              // Total reviews on profile
  starRating: number | null,        // 1-5 star rating
  detectedLanguage: string,         // 'en', 'es', 'pt', 'de'
  profileEnriched: boolean,
  profileEnrichedAt: timestamp,

  // AI personalization fields (Phase 2)
  personalizedIntro: string | null,      // For English: 2-3 sentence intro
  personalizedHtml: string | null,       // For non-English: Full HTML email
  personalizationModel: string,          // e.g., 'claude-sonnet-4-20250514'
  personalizationGenerated: boolean,
  personalizationGeneratedAt: timestamp,

  // Self-validation fields (two-pass approach)
  selfValidationPassed: boolean,         // Did content pass Claude's self-review?
  selfValidationScore: number,           // 1-10 quality score
  selfValidationScores: object,          // { tone, cultural, accuracy, brandSafety, personalization }
  selfValidationIssues: string[],        // Any issues found

  // Approval workflow
  personalizationApproved: boolean,      // Auto-approved if score >= 8
  manualReviewRequired: boolean,
  manualReviewedAt: timestamp,
  ctaDomain: string,                     // 'teambuildpro.com', 'es.teambuildpro.com', etc.

  // Email campaign fields
  sent: boolean,
  sentTimestamp: timestamp,
  status: string,              // 'sent', 'failed'
  subjectTag: string,          // 'bfh_v9a', 'bfh_v11a_personalized', etc.
  templateVariant: string,
  sendStrategy: string,        // 'standard_template', 'personalized_template', 'raw_html'
  sentLanguage: string,        // Language used for send (en/es/pt/de)
  randomIndex: number,
  clickedAt: timestamp,

  // Metadata
  source: 'bfh',
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### BFH Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `bfh-scraper.js` | Scrape BFH recommended distributors | `--seed` (URLs), `--scrape` (profiles), `--stats` |
| `bfh-email-search.js` | SerpAPI Google search for emails | `--search`, `--max=N`, `--stats` |
| `bfh-profile-enricher.js` | Enrich profiles (bio, reviews, language) | `--enrich`, `--max=N`, `--stats`, `--sample=URL` |
| `bfh-personalization-generator.js` | Generate AI personalized content | `--generate`, `--max=N`, `--force-review`, `--export-review`, `--approve --ids=...` |
| `mlm500-scraper.js` | Scrape MLM500 rankings + migrate to BFH | `--scrape`, `--search`, `--migrate-to-bfh`, `--stats` |

### BFH Personalization Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BFH ENRICHMENT PIPELINE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Phase 1: Profile Enrichment     Phase 2: AI Personalization               │
│  ─────────────────────────       ────────────────────────────               │
│  bfh-profile-enricher.js         bfh-personalization-generator.js          │
│  ├─ Scrape BFH profile page      ├─ Pass 1: Generate content               │
│  ├─ Extract bio/description      │   ├─ English → 2-3 sentence intro       │
│  ├─ Extract review snippets      │   └─ Non-English → Full HTML email      │
│  ├─ Extract star rating          ├─ Pass 2: Self-validate                  │
│  └─ Detect language (en/es/pt/de)│   ├─ Score 8-10 → Auto-approve          │
│                                  │   ├─ Score 5-7 → Manual review          │
│                                  │   └─ Score 1-4 → Regenerate             │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                         HYBRID SEND STRATEGY                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  email-campaign-bfh.js:                                                     │
│  ├─ English → Standard V9/V10 template                                     │
│  ├─ Non-English + personalizedHtml → Raw HTML via Mailgun                  │
│  └─ All campaigns now use V9/V10 (V11/V12 deprecated)                      │
│                                                                             │
│  Language-specific CTA domains:                                             │
│  ├─ en → teambuildpro.com                                                  │
│  ├─ es → es.teambuildpro.com                                               │
│  ├─ pt → pt.teambuildpro.com                                               │
│  └─ de → de.teambuildpro.com                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### FSR (FindSalesRep) Data Pipeline

**Two-Script Architecture** (Feb 2026): Separates fast ID harvesting from CAPTCHA-gated contact scraping for efficient pipeline processing.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Stage 1: ID Harvesting (NEW - Fast, Aggressive)                         │
│  scripts/fsr-id-harvester.js                                             │
│  Source: State+Company listing pages (no CAPTCHA needed)                 │
│  URL Pattern: https://{state}.findsalesrep.com/lc/{company}              │
│  Coverage: 25 states × 272 companies = 6,800 combinations                │
│  Schedule: 12x daily (every 2h), 50 pages/run                            │
│  Output: fsr_user_ids collection (userId, sourceState, sourceCompany)    │
│  Stops automatically when full cycle complete (cycleComplete: true)      │
├──────────────────────────────────────────────────────────────────────────┤
│  Stage 2: Contact Scraping (Existing - CAPTCHA-gated)                    │
│  scripts/fsr-scraper.js                                                  │
│  Source: fsr_user_ids where scraped==false                               │
│  Schedule: 4x daily, 75 contacts/run                                     │
│  Uses 2Captcha for reCAPTCHA solving                                     │
│  Output: fsr_contacts collection (email, name, company, location)        │
└──────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              FSR Campaign (email-campaign-fsr.js)
              Schedule: 10am, 1pm, 4pm, 7pm PT
              V9a/V10a A/B test rotation
```

### FSR Priority States (Top 25 by Population)
```javascript
const PRIORITY_STATES = [
  'ca', 'tx', 'fl', 'ny', 'pa',  // 1-5
  'il', 'oh', 'ga', 'nc', 'mi',  // 6-10
  'nj', 'va', 'wa', 'az', 'ma',  // 11-15
  'tn', 'in', 'md', 'mo', 'wi',  // 16-20
  'co', 'mn', 'sc', 'al', 'la'   // 21-25
];
```

### FSR Collection Schema: `fsr_user_ids`
```javascript
{
  userId: string,               // Unique user ID from FSR (e.g., '3725')
  profileUrl: string,           // https://www.findsalesrep.com/users/3725
  discoveredAt: timestamp,
  sourceState: string,          // State where discovered (e.g., 'tx')
  sourceCompany: string,        // Company page where found (e.g., 'avon')
  scraped: boolean,             // Becomes true after contact extraction
  scrapedAt: timestamp | null
}
```

### FSR Harvester State: `scraper_state/fsr_harvester`
```javascript
{
  currentStateIndex: number,    // 0-24 (rotates through 25 states)
  currentCompanyIndex: number,  // 0-271 (rotates through 272 companies)
  totalProcessed: number,       // Total state+company combinations processed
  totalIdsFound: number,        // Total user IDs discovered
  totalIdsSaved: number,        // New IDs saved (deduplicated)
  cycleComplete: boolean,       // True when all 6,800 combinations processed
  cycleCompletedAt: timestamp,  // When cycle finished
  lastState: string,
  lastCompany: string,
  updatedAt: timestamp
}
```

### FSR Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `fsr-id-harvester.js` | Fast ID harvesting from state+company pages | `--harvest --max-pages=50`, `--stats`, `--reset` |
| `fsr-scraper.js` | Contact scraping with 2Captcha | `--scrape --max=75`, `--stats` |

### FSR GitHub Actions Workflows

| Workflow | Schedule | Purpose |
|----------|----------|---------|
| `fsr-id-harvester.yml` | Every 2 hours (12x daily) | Harvest user IDs, 50 pages/run |
| `fsr-scraper.yml` | 4x daily | Scrape contacts from queue, 75/run |

### Purchased Leads Data Pipeline

The `purchased_leads` collection consolidates contacts from multiple sources for email campaigns. This collection uses the existing campaign infrastructure (`sendHourlyPurchasedLeadsCampaign`).

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Source 1: Apollo Contacts with Personal Emails                          │
│  scripts/analyze-apollo-personal-emails.js                               │
│  Extracts contacts with personal emails from Apollo CSV Secondary Email  │
│  ~709 contacts with gmail/yahoo/hotmail/etc                              │
├──────────────────────────────────────────────────────────────────────────┤
│  Source 2: Apollo SerpAPI Search                                         │
│  scripts/apollo-email-search.js                                          │
│  Google search for remaining contacts without personal emails            │
│  ~1,663 contacts → ~22% yield expected                                   │
├──────────────────────────────────────────────────────────────────────────┤
│  Migration: apollo-import-personal-emails.js                             │
│  Import to apollo_contacts collection                                    │
│  migrate-apollo-to-purchased-leads.js                                    │
│  Migrate to purchased_leads for campaign use                             │
├──────────────────────────────────────────────────────────────────────────┤
│  Cleanup: cleanup-purchased-leads.js                                     │
│  Remove corporate MLM domain emails (bounce risk)                        │
│  youngliving.com, herbalife.com, amway.com, etc.                         │
└──────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              Purchased Leads Campaign (email-campaign-purchased.js)
              Schedule: 9:30am, 12:30pm, 3:30pm, 6:30pm PT
              V9a/V10a A/B test rotation
```

### Purchased Leads Collection Schema: `purchased_leads`

```javascript
{
  // Core fields
  firstName: string,
  lastName: string,
  fullName: string,
  email: string,
  company: string | null,
  title: string | null,

  // Source tracking
  source: string,              // 'apollo', 'apollo_secondary', 'apollo_serpapi', 'data_axle'
  originalSource: string,      // Original source from migration
  batchId: string,             // Import batch identifier
  migratedFrom: string | null, // 'apollo_contacts' if migrated
  originalDocId: string | null,// Original document ID if migrated

  // Email campaign fields
  sent: boolean,
  sentTimestamp: timestamp,
  status: string,              // 'pending', 'sent', 'failed'
  subjectTag: string,          // 'purchased_v9a', etc.
  randomIndex: number,         // For A/B test distribution
  clickedAt: timestamp,

  // Metadata
  createdAt: timestamp,
  importedAt: timestamp
}
```

### Purchased Leads Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `analyze-apollo-personal-emails.js` | Extract non-corporate email contacts from Apollo CSV (blacklist approach using base_urls.txt) | `--analyze` (audit CSV), `--export` (create JSON files) |
| `audit-corporate-emails.js` | Audit all contact collections for blacklisted corporate domain emails | `--remove` (delete corporate contacts) |
| `apollo-email-search.js` | SerpAPI Google search for Apollo contacts | `--search`, `--max=N`, `--stats`, `--resume` |
| `apollo-import-personal-emails.js` | Import Apollo personal emails to Firestore | `--dry-run`, `--import`, `--stats` |
| `migrate-apollo-to-purchased-leads.js` | Migrate apollo_contacts to purchased_leads | `--dry-run`, `--migrate`, `--stats` |
| `cleanup-purchased-leads.js` | Remove corporate MLM domain emails | `--audit`, `--delete`, `--dry-run` |
| `audit-contact-duplicates.js` | Cross-collection duplicate detection | (runs audit across all contact collections) |

### Corporate MLM Domains Blacklist

Corporate email domains are excluded from all contact collections using a **blacklist approach**. The blacklist is sourced from `scripts/base_urls.txt` (841 MLM company domains) and includes:

```javascript
// Major MLM/Direct Sales companies (841 domains in base_urls.txt)
'youngliving.com', 'itworks.com', 'herbalife.com', 'avon.com', 'lifevantage.com',
'stelladot.com', 'shaklee.com', 'senegence.com', 'partylite.com', 'pamperedchef.com',
'myitworks.com', '4life.com', 'nuskin.com', 'origamiowl.com', 'beachbody.com',
'rodanandfields.com', 'arbonne.com', 'monat.com', 'melaleuca.com', 'marykay.com',
'tupperware.com', 'primerica.com', 'amway.com', 'isagenix.com', 'plexus.com',
'doterra.com', 'usana.com', 'advocare.com', 'nerium.com', 'neora.com',
'younique.com', 'youniqueproducts.com', 'worldventures.com', 'zurvita.com',
'pureromance.com', 'tranont.com', 'monatglobal.com', 'lularoe.com', 'colorstreet.com',
'scentsy.com', 'thirtyone.com', 'enagic.com', 'xyngular.com', 'foreverliving.com'
// Full list: ~70 domains in cleanup-purchased-leads.js
```

---

## 🚨 Critical Don'ts

1. **NEVER modify these files**:
   - `secrets/` directory
   - `ios/Runner/GoogleService-Info.plist`
   - `android/app/google-services.json`
   - `lib/firebase_options.dart`
   - `functions/serviceAccountKey.json`

2. **NEVER mix Firebase UIDs with UUIDs**
   - All references must use Firebase authentication UIDs

3. **NEVER bypass unified notification system**
   - Always use `createNotificationWithPush()` function

4. **NEVER use emojis unless explicitly requested**
   - Professional tone throughout

5. **NEVER create new files unless necessary**
   - Always prefer editing existing files

6. **NEVER automatically deploy to Firebase hosting**
   - ONLY render changes locally using `open` command
   - User will handle ALL Firebase hosting deployments manually
   - Do NOT run `firebase deploy` commands

7. **NEVER set `cleanUrls: true` in firebase.json**
   - All TBP websites use explicit `.html` extensions in URLs
   - `cleanUrls: true` strips `.html` extensions and causes redirect loops
   - The main hosting target MUST have `"cleanUrls": false`
   - Redirect rules like `/faq` → `/faq.html` are intentional for SEO
   - Changing this setting breaks the entire website with "too many redirects" errors

8. **NEVER delete prospects.html or professionals.html**
   - These are critical landing pages for referral flows (exist in all 4 languages: EN, ES, PT, DE)
   - They are intentionally blocked from search indexing via robots.txt
   - They must NEVER be added to sitemap.xml files
   - They must NEVER be removed from robots.txt Disallow rules
   - Deleting these files causes 404 errors that negatively impact Google Search Console

---

## 🎓 Learning Resources

### Documentation Files
- `/Users/sscott/tbp/CLAUDE.md` - Comprehensive development guide
- `/Users/sscott/tbp/documents/` - App Store metadata and documentation
- This file - Persistent knowledge base

### Key Source Files to Understand
- `lib/main.dart` - App initialization
- `lib/services/auth_service.dart` - Authentication
- `lib/services/network_service.dart` - Advanced caching
- `lib/screens/share_screen.dart` - 16 pre-written messages
- `lib/screens/dashboard_screen.dart` - Main dashboard with stats and action cards (responsive text handling for multilingual support)
- `lib/screens/how_it_works_screen.dart` - How It Works (fully localized in 4 languages)
- `lib/screens/platform_management_screen.dart` - Admin account creation (fully localized in 4 languages)
- `lib/widgets/biz_opp_education_modal.dart` - Business opportunity education modal
- `lib/widgets/quick_prompts_widget.dart` - AI Coach welcome screen with quick prompts
- `lib/l10n/app_*.arb` - Localization files (EN, ES, PT, DE)
- `functions/index.js` - All Cloud Functions
- `functions/email-campaign-functions.js` - Main Campaign (emailCampaigns/master/contacts)
- `functions/email-campaign-contacts.js` - Contacts Campaign (direct_sales_contacts)
- `functions/email-campaign-bfh.js` - BFH Campaign (bfh_contacts)
- `functions/email-campaign-paparazzi.js` - Paparazzi Campaign + testPaparazziEmail spam test endpoint
- `functions/email-stats-functions.js` - Email campaign stats API (Firestore + GA4)
- `functions/analytics-dashboard-functions.js` - TBP analytics dashboard API (GA4 + iOS + Android + Firestore)
- `functions/email-smtp-sender.js` - SMTP transporter with connection pooling
- `functions/email_templates/tbp-smtp-template.js` - SMTP email template (personal note style)
- `functions/sendLaunchCampaign.js` - Manual launch announcement emails
- `web/TBP-analytics.html` - TBP analytics dashboard (Website/iOS/Android tabs)
- `web/email-stats.html` - Email campaign stats dashboard
- `web/faq.html` - Dynamic FAQ implementation
- `scripts/scrape-bfh-companies.js` - BFH company scraper (base_urls.txt source)
- `scripts/base_url_discovery.js` - URL pattern discovery (Common Crawl → patterns.json)
- `scripts/seed-contacts-urls.js` - Multi-source URL seeder (CC + Wayback + crt.sh → Firestore)
- `scripts/contacts-scraper.js` - Puppeteer contact scraper (Firestore → emails/phones)
- `scripts/bfh-scraper.js` - BFH profile scraper (Business For Home → bfh_contacts)
- `scripts/bfh-email-search.js` - SerpAPI email discovery for BFH contacts
- `scripts/bfh-profile-enricher.js` - BFH profile enrichment (bio, reviews, language detection)
- `scripts/bfh-personalization-generator.js` - Claude AI personalization with two-pass validation
- `scripts/mlm500-scraper.js` - MLM500 rankings scraper with BFH migration

### Utility Scripts (functions/)
- `count-todays-emails.js` - Query Firestore for daily email send counts
- `get-mailgun-stats.js` - Query Mailgun API for delivery/engagement statistics (legacy - pre-SMTP migration)
- `test-email.js` - Send test emails via Mailgun for campaign testing (legacy)
- `reset-failed-contacts.js` - Reset failed email campaign contacts from Mailgun CSV exports (legacy)
- `reset_failed_batch.js` - Batch processing for failed contact resets
- `reset_failed_contacts.js` - Alternative reset script for email campaign recovery
- `mark-contacts-for-resend.js` - Mark all contacts sent before Nov 12, 2025 for Android launch resend campaign

### Utility Scripts (scripts/)
- `generate-ai-blog.js` - AI-powered blog generation using Claude CLI
  - `--title "Title"` - Generate blog with specific title (EN, ES, PT, DE)
  - `--research` - Research mode: analyze trends and recommend topics
  - `--full-auto` - Full automation: research, generate, deploy, notify
  - `--notify-email=EMAIL` - Recipient for notification emails
  - Generates 4 language versions: English, Spanish, Portuguese, German
- `generate-blog.js` - Legacy blog generation (static template approach)

**Spam Monitoring:**
- `gmail-oauth-setup.js` - One-time OAuth setup for Gmail API access
  - Run interactively to authorize Gmail API
  - Outputs refresh token for GMAIL_OAUTH_TOKEN secret
  - Requires GMAIL_OAUTH_CREDENTIALS secret (OAuth client JSON)
- `spam-monitor.js` - Email spam detection and auto-disable system
  - **Calls `testPaparazziEmail` Cloud Function endpoint** to test actual campaign code (prevents drift)
  - Tests variants v9a and v10b to cover both subject lines
  - Checks Gmail API for inbox vs spam placement
  - Auto-disables **ALL 6 campaigns** if spam detected:
    - `batchSize`, `batchSizePurchased`, `batchSizeBfh`, `batchSizePaparazzi`, `batchSizeFsr`, `batchSizeZinzino`
  - Sends alert email via Mailgun on spam detection
  - Stores previous batch size values for recovery
  - Schedule: Daily 6am PT via `.github/workflows/spam-monitor.yml`
- `testPaparazziEmail` - HTTP endpoint for spam monitoring (in `email-campaign-paparazzi.js`)
  - POST body: `{ email, variants: ['v9a', 'v10b'], subjectSuffix: "(Feb 23, 6:00 AM)" }`
  - Uses same `sendEmailViaMailgun` function as production campaign
  - Accepts `subjectSuffix` parameter for accurate Gmail search identification

**Contact Data Management:**
- `analyze-apollo-personal-emails.js` - Extract contacts with personal emails from Apollo CSV
  - `--analyze` - Audit CSV and categorize contacts (personal email vs needs search)
  - `--export` - Export to JSON files for import
  - Input: `purchased-emails/apollo-export.csv`
  - Output: `apollo-personal-emails.json` (~709), `apollo-needs-serpapi.json` (~1,663)
- `apollo-email-search.js` - SerpAPI Google search for Apollo contacts
  - `--search` - Run searches (resumes from progress file)
  - `--max=N` - Limit searches
  - `--stats` - Show progress statistics
  - Rate limit: 4s delay (900/hour, Developer plan)
  - Saves progress to `apollo-serpapi-progress.json`
- `apollo-import-personal-emails.js` - Import Apollo personal emails to Firestore
  - `--dry-run` - Preview import
  - `--import` - Execute import to `apollo_contacts` collection
  - `--stats` - Show collection stats
- `migrate-apollo-to-purchased-leads.js` - Migrate apollo_contacts to purchased_leads
  - `--dry-run` - Preview migration
  - `--migrate` - Execute migration
  - `--stats` - Show collection stats
- `cleanup-purchased-leads.js` - Remove corporate MLM domain emails (bounce risk)
  - `--audit` - Analyze and categorize by domain type
  - `--delete` - Delete corporate email contacts
  - `--dry-run` - Preview deletions
  - Excludes: ~70 corporate MLM domains (youngliving.com, herbalife.com, etc.)
- `audit-contact-duplicates.js` - Cross-collection duplicate detection
  - Audits: bfh_contacts, direct_sales_contacts, emailCampaigns/master/contacts, purchased_leads, apollo_contacts
- `audit-corporate-emails.js` - Audit and clean corporate domain emails from all collections
  - Loads blacklist from `scripts/base_urls.txt` (841 MLM company domains)
  - Audits: emailCampaigns/master/contacts, bfh_contacts, direct_sales_contacts, purchased_leads
  - `--remove` - Delete corporate email contacts

**BFH Data Pipeline:**
- `scrape-bfh-companies.js` - Scrape BusinessForHome.org sitemap for MLM company URLs
  - Fetches company-sitemap.xml (~710 companies), extracts website URLs from detail pages
  - Appends new URLs to `base_urls.txt` (grew 462 → 1,082)
  - `--dry-run` flag for preview mode
- `base_url_discovery.js` - Discover distributor URL patterns from Common Crawl
  - `--all --limit=120` - Process next 120 unprocessed companies
  - `--company=herbalife` - Process specific company
  - Output: `patterns.json` with subdomain/path/third-party patterns
- `seed-contacts-urls.js` - Seed distributor URLs into Firestore from 3 web indexes
  - Sources: Common Crawl + Wayback Machine + crt.sh Certificate Transparency
  - `--all --limit=40` - Process next 40 companies with patterns
  - `--company=monat` - Process specific company
  - `DRY_RUN=true` for preview mode
- `contacts-scraper.js` - Puppeteer-based contact scraper for distributor pages
  - `--all --max=400` - Scrape up to 400 URLs across all companies
  - `--company="Monat"` - Scrape specific company
- `mlm500-scraper.js` - MLM500 rankings scraper
  - `--scrape` - Scrape MLM500 rankings pages
  - `--search` - SerpAPI email search for contacts
  - `--migrate-to-bfh` - Migrate contacts with emails to bfh_contacts
  - `--stats` - Show collection statistics

---

## 🔄 Recent Changes & Milestones

### Key Milestones (Nov 2025 - Feb 2026)

**App Launches & Localizations**
- ✅ **Google Play Store Launch** (Nov 12, 2025): Android app live
- ✅ **Multi-Language Websites** (Nov 21-30): Launched ES, PT, DE sites with full content parity
- ✅ **App Store Localizations** (Dec 2025): App names localized across iOS and Android
  - ES: "Team Build Pro: IA Equipo", PT: "Team Build Pro: IA Equipe", DE: "Team Build Pro: KI Team"

**Email Campaign Infrastructure**
- ✅ **Template Simplification** (Feb 19, 2026): Consolidated to v9/v10 as primary templates
  - V9: Statistical hook ("75% quit in first year") + systems problem framing + 3-feature list
  - V10: Credentials hook ("After 20+ years in tech and direct sales") + pattern observation
  - V11/V12 deprecated: Were personalized_intro variants, now unused (personalization not utilized)
  - Purchased campaign switched from v11a/v12a to v9a/v10a
  - Updated v9-es, v9-de, v10-es, v10-de translations to match new English templates
- ✅ **Email Campaigns via Mailgun API**: Both Main and Contacts campaigns use Mailgun API with template versioning
  - Sending domain: `news.teambuildpro.com` with 10/10 mail-tester.com score (SPF/DKIM/DMARC configured)
  - Open tracking disabled for deliverability; click tracking via GA4 UTM parameters
  - SMTP sender utility (`email-smtp-sender.js`) exists but is used only for blog notifications, not campaigns
- ✅ **A/B Testing Active**: Main campaign uses 4-way V9/V10 test (Feb 12, 2026)
  - V9a: V9 template + "AI is changing how teams grow" (`main_v9a`)
  - V9b: V9 template + "Your AI-powered recruiting assistant" (`main_v9b`)
  - V10a: V10 template + "AI is changing how teams grow" (`main_v10a`)
  - V10b: V10 template + "Your AI-powered recruiting assistant" (`main_v10b`)
  - Contacts campaign still uses V7/V8 (`mobile_first_v7`/`mobile_first_v8`)
- ✅ **A/B Test Template Update** (Feb 11, 2026): Migrated from v3/v4 to v7/v8 Mailgun templates
  - Simplified HTML template with text link CTA (improved inbox placement vs Promotions/Spam)
  - Fixed From address typo in templates v4-v8 (was missing "t" in teambuildpro)
- ✅ **4-Way A/B Test Deployed** (Feb 12, 2026): Main campaign upgraded to V9/V10 × 2 subject lines
  - Matches purchased leads campaign A/B test configuration
  - Dashboards updated to track new `main_v9a/v9b/v10a/v10b` subject lines
- ✅ **Yahoo Campaign Removed** (Jan 31, 2026): File and function deleted
- ✅ **Android Launch Campaign Removed** (Jan 31, 2026): Function deleted from `email-campaign-functions.js`
- ✅ **Contacts Campaign Added** (Jan 31, 2026): New campaign targeting `direct_sales_contacts` collection with company-specific subject lines
- ✅ **Campaign Schedules Staggered** (Jan 31, 2026): Main (8am, 11am, 2pm, 5pm) + Contacts (9am, 12pm, 3pm, 6pm) = 8 runs/day total
- ✅ **Sitemap Ping Automation** (Jan 31, 2026): Added to `weekly-blog.yml` workflow
  - Pings Google and Bing with all 4 sitemaps after Firebase deploy
  - URLs: teambuildpro.com, es., pt., de. sitemap.xml
- ✅ **Project Paused for Monitoring** (Jan 31, 2026): Active development paused to allow systems to mature
  - Domain warming needs 6+ weeks to reach full capacity
  - SEO requires 3-6 months for meaningful ranking data
  - Revisit mid-March 2026 for data-driven optimization
- ✅ **Domain Warming Automation**: GitHub Actions workflow manages batch sizes via Firestore config
- ✅ **SMTP Email Validation**: 18,334 Gmail addresses validated, 89.3% valid
- ✅ **Analytics Dashboards Updated**: Both `email-stats.html` and `TBP-analytics.html` use Firestore for send stats and GA4 for click tracking via UTM parameters (sessionMedium: 'email').

**Contacts Discovery Pipeline** (Feb 2026)
- ✅ **BFH Company Scraper** (`scripts/scrape-bfh-companies.js`): Scrapes BusinessForHome.org sitemap (~710 companies), extracts website URLs, appends to `base_urls.txt`
  - Grew company list from 462 → 1,082 URLs (620 new companies added)
  - Uses cheerio + axios (no Puppeteer needed), 500ms delay between requests
  - Supports `--dry-run` flag for preview mode
- ✅ **Multi-Source URL Seeder**: `seed-contacts-urls.js` now queries 3 sources instead of just Common Crawl:
  1. Common Crawl Index API (17 indexes, 2024-2026)
  2. Wayback Machine CDX API (Internet Archive historical data)
  3. Certificate Transparency logs via crt.sh (subdomain discovery)
  - Monat test: 0 new URLs (CC only) → 452 new URLs (all 3 sources)
- ✅ **Firestore Blocked-Platform Filtering**: `seed-contacts-urls.js` loads `config/contactsScraper.blockedPlatforms` to skip companies already marked as blocked by `contacts-scraper.js`
- ✅ **Auto-Cleanup of Blocked URLs**: `contacts-scraper.js` deletes unscraped URLs from blocked companies at start of each run
  - Blocked platforms (12): doTERRA, Ambit Energy, Le-Vel, Herbalife, Zilis, It Works!, Arbonne, LifeWave, Scentsy, Young Living, Nu Skin, Shaklee
- ✅ **URL Discovery Throughput 3x**: Workflow batch size 40→120, schedule every 4h→every 2h
  - Processes 1,082 companies in ~10 hours instead of ~4 days
- ✅ **FSR ID Harvester** (Feb 20, 2026): Two-script architecture for efficient FSR pipeline
  - `scripts/fsr-id-harvester.js` - Fast ID harvesting from state+company pages (no CAPTCHA)
  - 25 states × 272 companies = 6,800 combinations
  - 12x daily schedule (every 2 hours), 50 pages/run
  - Auto-stops when `cycleComplete: true` (prevents infinite loops)
  - `--reset` CLI option to restart cycle
  - Modified `fsr-scraper.js` to consume from `fsr_user_ids` queue

**Automation Systems**
- ✅ **Automated Blog Generation**: Twice-weekly (Mon/Thu) via GitHub Actions + Claude CLI
  - Generates posts in EN, ES, PT, DE
  - Auto-deploys to Firebase Hosting
  - Pings Google and Bing sitemaps after deploy
  - Scripts: `generate-ai-blog.js`, `generate-sscott-blog.js`
- ✅ **PreIntake.ai Workflows**: Bar scrapers + email campaign + analytics (see `preintake/CLAUDE.md`)

**Website Enhancements**
- ✅ **Prospect/Professional Pages Restored** (Feb 12, 2026): Critical landing pages restored after GSC 404 errors
  - `prospects.html` and `professionals.html` restored in all 4 languages (EN, ES, PT, DE)
  - These pages are blocked from indexing via robots.txt (intentional - not for SEO)
  - Must NEVER be deleted or added to sitemaps
  - `index.html` also handles `?new=` and `?ref=` dynamically as fallback
- ✅ **Referral Tracking**: Cross-page tracking with sessionStorage, invite bar on all pages
- ✅ **Testimonial Section**: 5-star review from "Arya N." on all homepage variants
- ✅ **App Store URLs Standardized**: Simplified format `apps.apple.com/us/app/id6751211622` across 328 files
- ✅ **SEO Audits**: Canonical URLs, hreflang tags, sitemaps verified across all sites

**Analytics Dashboard Enhancements** (Jan-Feb 2026)
- ✅ **Top Countries Feature**: Added GA4 country dimension query to TBP Analytics Dashboard
  - Backend: New GA4 report query using `country` dimension in `analytics-dashboard-functions.js`
  - Frontend: Dynamic country data display in `TBP-analytics.html` (was previously hardcoded "not available")
- ✅ **Yesterday Date Range**: Added "Yesterday" option to date range selector
  - Backend: `fetchGA4Analytics('yesterday')` support with startDate=endDate='yesterday'
  - Frontend: New "Yesterday" button in date range selector
- ✅ **Today Date Range** (Feb 5, 2026): Added "Today" option to date range selector
  - Backend: `fetchGA4Analytics('today')` support with startDate=endDate='today'
  - Frontend: New "Today" button in date range selector (to right of Yesterday)

**Codebase Audit** (Feb 11, 2026)
- ✅ **Comprehensive audit** of Flutter app, Cloud Functions, and all websites (EN, ES, PT, DE, Author)
- ✅ **Deleted placeholder firebase_options**: Removed `lib/firebase/firebase_options.dart` (duplicate that returned null)
- ✅ **Fixed IAP service crash risks** (`lib/services/iap_service.dart`):
  - Changed `late StreamSubscription` to nullable `StreamSubscription?` to prevent race condition
  - Added `.firstOrNull` with null check for product lookup (was crashing on missing product)
  - Added null checks for type casting in Apple/Google subscription validation
- ✅ **Fixed BuildContext async gap** (`lib/screens/edit_profile_screen.dart`):
  - Captured ScaffoldMessenger before async operations to avoid invalid context access
- ✅ **Removed duplicate Cloud Function**: Deleted `getUserByReferralCode` from `analytics-functions.js` (kept in `auth-functions.js`)
- ✅ **Fixed broken blog links**:
  - `ai-10x-your-mlm-recruiting-results-2025-field.html`: Fixed link to `30-day-pre-qualification-beats-traditional-mlm.html`
  - `social-media-algorithm-apocalypse-mlm-recruiters.html`: Fixed `/download.html` link to `https://teambuildpro.com`
- ✅ **Fixed PreIntake firebase.json**: Changed `cleanUrls: true` to `false` (was inconsistent with TBP sites)
- ✅ **Fixed GitHub workflow**: Removed unused `MAILGUN_DOMAIN` env variable from `preintake-email-campaign.yml`

**Analytics Dashboard & Campaign Optimization (Feb 14, 2026)**
- ✅ **Dashboard Restructured**: Removed Contacts Campaign (complete), broke out Email Campaign Performance into 3 separate cards (Main/Purchased/BFH)
- ✅ **Remaining Count Fix**: Fixed incorrect remaining counts by querying actual `sent == false` count instead of calculating `total - sent`
- ✅ **Firestore Indexes Added**: Composite indexes for `sent + sentTimestamp` on `bfh_contacts` and `direct_sales_contacts` for benchmark queries
- ✅ **Batch Size Optimization**: Configured for ~30-day completion across all campaigns
  - Main: 20 → 50 (200 emails/day)
  - Purchased: 20 → 15 (60 emails/day)
  - BFH: 20 → 10 (40 emails/day)
  - Total: 300 emails/day
- ✅ **MLM500 Migration**: Migrated 583 contacts from mlm500_staging to bfh_contacts (BFH grew from 369 to 952 contacts)

**Contact Data Pipeline (Feb 13, 2026)**
- ✅ **Apollo Contact Recovery**: Salvaged $99 Apollo purchase by extracting personal emails from Secondary Email field
  - 709 contacts with personal emails (gmail, yahoo, hotmail) imported directly
  - 1,663 contacts queued for SerpAPI search (~22% yield expected)
- ✅ **BFH Profile Enrichment**: Completed enrichment of 387 BFH contacts
  - Language detection: EN=373, ES=12, PT=1, DE=1
  - Ready for AI-personalized email generation
- ✅ **purchased_leads Cleanup**: Removed 2,036 corporate MLM domain emails
  - Corporate domains (youngliving.com, herbalife.com, etc.) would bounce
  - 966 valid contacts remaining after cleanup
- ✅ **Cross-collection Deduplication Audit**: Verified minimal overlap across all contact sources
  - 0 duplicates between BFH ↔ Direct Sales, 0 BFH ↔ Email Campaign
  - Only 2 duplicates between Direct Sales ↔ Email Campaign
- ✅ **Apollo SerpAPI Pipeline**: Scripts created for batch email discovery
  - `apollo-email-search.js` with progress saving and resume capability
  - Rate limited at 4s delay (900 searches/hour, Developer plan)

**Corporate Email Cleanup (Feb 15, 2026)**
- ✅ **Blacklist Approach Implemented**: `analyze-apollo-personal-emails.js` switched from whitelist (only accept gmail, yahoo, etc.) to blacklist (exclude corporate MLM domains from `base_urls.txt`)
- ✅ **4 Domains Added to Blacklist**: avon.com, beachbody.com, rodanandfields.com, tupperware.com (now 841 total)
- ✅ **Corporate Email Audit Script**: `audit-corporate-emails.js` audits all 4 contact collections for blacklisted domains
- ✅ **246 Corporate Emails Removed**:
  - bfh_contacts: 952 → 886 (66 removed)
  - direct_sales_contacts: 981 → 826 (155 removed, mostly myecon.net)
  - purchased_leads: 1,427 → 1,402 (25 removed)
  - emailCampaigns/master/contacts: 0 corporate emails (already clean)

**Email Spam Fix & Monitoring Infrastructure (Feb 23, 2026)**
- ✅ **Spam-Triggering Subject Removed**: Subject "Not an opportunity. Just a tool." identified as Gmail spam trigger
  - All campaigns updated to use safe alternatives: "AI is changing how teams grow" and "Your AI-powered recruiting assistant"
  - Affected files: `email-campaign-functions.js`, `email-campaign-purchased.js`, `email-campaign-bfh.js`, `email-campaign-fsr.js`, `email-campaign-paparazzi.js`, `email-campaign-zinzino.js`
- ✅ **Click Tracking Changed to GA4**: Direct landing page URLs with UTM parameters now used instead of Cloud Function redirect URLs
  - Reduces spam triggers from multiple redirects
  - Click tracking via GA4 (sessionMedium: 'email') instead of Firestore trackEmailClick endpoint
- ✅ **Spam Monitor Endpoint Created**: `testPaparazziEmail` HTTP endpoint in `email-campaign-paparazzi.js`
  - Tests actual campaign code (prevents code drift between monitor and campaigns)
  - Accepts `subjectSuffix` parameter for Gmail search identification
  - Returns sent emails with full subject lines and message IDs
- ✅ **Spam Monitor Script Updated**: `scripts/spam-monitor.js` now uses Cloud Function endpoint
  - Calls `testPaparazziEmail` instead of sending emails directly
  - Tests variants v9a and v10b to cover both safe subjects
  - Disables ALL 6 campaigns if spam detected (batchSize, batchSizePurchased, batchSizeBfh, batchSizePaparazzi, batchSizeFsr, batchSizeZinzino)
- ✅ **Paparazzi Campaign Added**: New campaign for `paparazzi_contacts` collection
  - Schedule: 10:30am, 1:30pm, 4:30pm, 7:30pm PT (4 runs/day)
  - 4-way A/B test: V9/V10 × 2 subjects
  - Batch size controlled via `config/emailCampaign.batchSizePaparazzi`
- ✅ **Paparazzi Firestore Indexes Added**: 3 composite indexes for `paparazzi_contacts` collection
  - `status + sent + randomIndex` (for campaign email send query)
  - `sent + sentTimestamp DESC` (for benchmark filtering)
  - `sent + sentTimestamp ASC` (for benchmark filtering)

**FSR Campaign & Subscription Updates (Feb 19, 2026)**
- ✅ **FSR Email Campaign Created**: New campaign for FindSalesRep contacts
  - File: `functions/email-campaign-fsr.js`
  - Collection: `fsr_contacts` (17 contacts with emails from 24 scraped)
  - Schedule: 10am, 1pm, 4pm, 7pm PT (4 runs/day)
  - A/B test: V9a/V10a with 2-way strict alternation
  - Control: `config/emailCampaign.batchSizeFsr` (set to 5)
- ✅ **FSR Firestore Indexes Added**: 3 composite indexes for `fsr_contacts` collection
  - `sent + email + randomIndex`
  - `sent + sentTimestamp DESC`
  - `sent + sentTimestamp ASC`
- ✅ **Subscription Expiring Reminder Disabled**: `checkSubscriptionsExpiringSoon` in `admin-functions.js`
  - Apple App Store and Google Play handle automatic subscription renewals
  - Reminders unnecessary and potentially confusing for auto-renewing subscriptions
  - Users don't need to take action - billing happens automatically

### Current System Status (Feb 23, 2026)

**PROJECT STATUS: FOCUSED CAMPAIGNS (Feb 19, 2026)**
Main Campaign reduced due to underperformance. Focus shifted to BFH, Purchased, FSR, and Paparazzi campaigns for Team Build Pro promotion.

| Component | Status | Notes |
|-----------|--------|-------|
| Main Campaign | Reduced | 8am, 11am, 2pm, 5pm PT · **2/batch** · underperforming click-through |
| Purchased Campaign | **Primary** | 9:30am, 12:30pm, 3:30pm, 6:30pm PT · 15/batch · 1,402 contacts |
| BFH Campaign | **Primary** | 10am, 1pm, 4pm, 7pm PT · 10/batch · 776 contacts |
| Paparazzi Campaign | Active | 10:30am, 1:30pm, 4:30pm, 7:30pm PT · uses `paparazzi_contacts` |
| FSR Campaign | Active | 10am, 1pm, 4pm, 7pm PT · 5/batch · 17 contacts (new Feb 19) |
| Contacts Campaign | Complete | 826 contacts (cleaned Feb 15) |
| Email Sending | Mailgun API | Via Mailgun, news.teambuildpro.com |
| Email A/B Testing | Active | Safe subjects only (spam-trigger removed Feb 23) |
| Yahoo Campaign | Removed | File and function deleted (Jan 31) |
| Android Campaign | Removed | Function and all references deleted |
| Subscription Reminders | Disabled | Auto-renewal handled by app stores (Feb 19) |
| Email Tracking | GA4 | Clicks via UTM parameters; opens disabled |
| Analytics Dashboard | Enhanced | 6 campaign cards, GA4 click tracking, improved remaining counts |
| Push Notifications | Working | profile_reminder, trial_expired verified |
| Blog Automation | Running | Mon/Thu schedule, 4 languages (24/24/24/23 posts) |
| Sitemap Pings | Active | Google + Bing pinged after each blog deploy |
| URL Discovery | Active | Every 2h, 120 companies/batch (processing 1,082 companies) |
| Contacts Seeder | Active | Every 4h, 3 sources (Common Crawl + Wayback + crt.sh) |
| Contacts Scraper | Active | Hourly, 400 URLs/batch, 12 blocked platforms |
| BFH Collection | 776 contacts | Primary campaign focus (Feb 18) |
| FSR ID Harvester | Active | Every 2h (12x daily), 50 pages/run, 6,800 combinations |
| FSR Contact Scraper | Active | 4x daily, 75/run, consumes fsr_user_ids queue |
| FSR Collection | 17+ contacts | Two-script architecture (Feb 20) |
| Spam Monitor | Active | Daily 6am PT, Gmail API check, auto-disable on spam |
| PreIntake.ai | Autonomous | See `preintake/CLAUDE.md` for details |

**Monitoring Checklist (Weekly):**
- [ ] Email click rates via `/email-stats.html`
- [ ] Traffic sources in `/TBP-analytics.html`
- [ ] App store downloads (iOS/Android tabs)
- [ ] Google Search Console for blog indexing
- [ ] Spam monitor workflow runs (GitHub Actions)

---

## 📞 Contact & Support

- **Creator**: Stephen Scott (sscott@info.teambuildpro.com)
- **Support Email**: support@teambuildpro.com
- **GitHub**: Private repository
- **Firebase Project**: teambuilder-plus-fe74d

---

## 🎯 Business Model

**NOT a business opportunity** - Team Build Pro is a B2B SaaS tool:
- **Revenue Model**: Subscription ($6.99/month after 30-day trial)
- **Target Market**: Direct sales professionals and their prospects
- **Competitive Advantage**: Only platform enabling pre-building teams before joining
- **Distribution**: iOS App Store, Google Play Store

---

*This knowledge base should be referenced at the start of each new AI assistant session to maintain context and understanding of Team Build Pro.*
