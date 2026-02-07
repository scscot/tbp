# Team Build Pro - Comprehensive Knowledge Base

**Last Updated**: 2026-02-06 (Prospect/Referral Page Consolidation)
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
│    Blog (21 posts)        Blog (20-21 each)     Blog (20-21 each)     │
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
- Cold email to 17,900+ direct sales professionals
- Mailgun API via news.teambuildpro.com with Firestore tracking
- Click tracking via trackEmailClick endpoint; open tracking disabled for deliverability
- Drives traffic to landing page → app downloads

**7. Legacy Brand (teambuildingproject.com)**
- Historical domain from earlier brand iteration
- Configured with redirects to teambuildpro.com
- Preserves any existing backlinks for SEO value

### Ecosystem Metrics & KPIs

| Metric | Current Value | Target |
|--------|---------------|--------|
| Email Click Rate | Tracked via Firestore | 3%+ |
| Email Open Rate | N/A (disabled for deliverability) | - |
| Website Languages | 4 (EN, ES, PT, DE) | 4 |
| Blog Posts (per language) | 20-21 | 25+ |
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
- **Functions**: 99 Cloud Functions handling real-time operations
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
│   └── blog/             # Blog posts (21 articles)
├── web-es/                # Spanish website (es.teambuildpro.com)
│   ├── index.html        # Spanish homepage
│   ├── faq.html          # Spanish FAQ
│   ├── books.html        # Spanish books page
│   ├── blog/             # Spanish blog (21 translated posts)
│   ├── sitemap.xml       # Spanish sitemap
│   └── robots.txt        # Spanish search engine directives
├── web-pt/                # Portuguese website (pt.teambuildpro.com)
│   ├── index.html        # Portuguese homepage
│   ├── faq.html          # Portuguese FAQ
│   ├── books.html        # Portuguese books page
│   ├── blog/             # Portuguese blog (21 translated posts)
│   ├── sitemap.xml       # Portuguese sitemap
│   └── robots.txt        # Portuguese search engine directives
├── web-de/                # German website (de.teambuildpro.com)
│   ├── index.html        # German homepage (3x2 screenshot grid)
│   ├── faq.html          # German FAQ
│   ├── books.html        # German books page
│   ├── blog/             # German blog (20 translated posts)
│   ├── sitemap.xml       # German sitemap
│   └── robots.txt        # German search engine directives
├── sscott/                # Stephen Scott author website (stephenscott.us)
│   ├── public/           # Author site pages (migrated from Dreamhost to Firebase)
│   │   ├── index.html   # Author homepage
│   │   ├── books.html   # Author books catalog
│   │   ├── books/       # 13 individual book pages
│   │   ├── podcasts.html # Podcast listings
│   │   ├── blog.html    # Author blog index
│   │   └── blog/        # 16 blog posts (auto-generated weekly)
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
- All referral handling consolidated on `index.html` (no separate prospect/professional pages)
- `?new=ABC` = Prospect view: "Invited by" bar, hides professionals section, TBP_Prospects.mp4 video
- `?ref=ABC` = Professional view: "Recommended by" bar, full page content, TBP_Professionals.mp4 video
- No params = Default view: full page content, TBP_Professionals.mp4 video
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
- Blog index with 20+ translated posts
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
- `/blog/` - 21 blog posts (auto-generated twice weekly via GitHub Actions)
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
- `/blog/` - 21 translated blog posts (same titles as EN)
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
- `/blog/` - 21 translated blog posts (same titles as EN)
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
- `/blog/` - 20 translated blog posts (same titles as EN)
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
- **Date range selector**: 30 Days, 7 Days, Yesterday options
- **Email Campaign section**: Firestore stats (sent/remaining/failed/clicked, A/B test results) + GA4 campaign traffic
- **iOS tab**: App Store Connect metrics (downloads, impressions, reviews, versions)
- **Android tab**: Google Play metrics from GCS bucket + CSV import fallback
- AI-generated observations via OpenAI
- Backend: `getTBPAnalytics` Cloud Function combining GA4, App Store Connect, Google Play, and Firestore data

**Email Stats Dashboard** (`web/email-stats.html` + `functions/email-stats-functions.js`)
- Password-protected dashboard at `/email-stats.html`
- **Data sources**: Firestore (`emailCampaigns/master/contacts`) + GA4 (filtered by `sessionMedium: 'email'`)
- **Tracking**: Click tracking via `trackEmailClick` Cloud Function; open tracking disabled for deliverability
- **Metrics**: Campaign progress (sent/remaining/failed), click tracking, A/B test subject line breakdown
- **A/B test tags**: `mobile_first_v3` (V3) and `mobile_first_v4` (V4); legacy tags `not_opportunity`, `prebuild_advantage`, `subject_recruiting_app`, `unknown` supported for historical data
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

The email campaign system consists of two parallel campaigns targeting different audience segments, using Mailgun API with Firestore-based tracking.

**Email Configuration:**
- **Sending Domain**: `news.teambuildpro.com`
- **From**: `Stephen Scott <stephen@news.teambuildpro.com>`
- **Template**: Mailgun-hosted 'mailer' template with v1-v6 versions (personal note style)
- **Subject A/B Test**: V3/V4 "Using AI to Build Your Team" (`mobile_first_v3` / `mobile_first_v4`)
- **Tracking**: Click tracking via `trackEmailClick` Cloud Function endpoint; open tracking disabled (pixel removed for deliverability)
- **DNS**: SPF + DKIM + DMARC configured for 10/10 mail-tester.com score
- **SMTP Credentials**: `functions/.env.teambuilder-plus-fe74d` (TBP_SMTP_* variables)

### Main Campaign (Mailgun API - Automated)
- **Function**: `sendHourlyEmailCampaign` in `functions/email-campaign-functions.js`
- **Tags**: `tbp_campaign`, `tracked`
- **Schedule**: 8am, 11am, 2pm, 5pm PT (4 runs/day)
- **Data Source**: Firestore `emailCampaigns/master/contacts` collection
- **Control Variable**: EMAIL_CAMPAIGN_ENABLED
- **Batch Size**: Dynamic via Firestore `config/emailCampaign.batchSize` (automated by GitHub Actions)
- **Domain Warming**: Automated via `.github/workflows/domain-warming-update.yml`

### Contacts Campaign (Mailgun API - Automated)
- **Function**: `sendHourlyContactsCampaign` in `functions/email-campaign-contacts.js`
- **Tags**: `contacts_campaign`, `tracked`
- **Schedule**: 9am, 12pm, 3pm, 6pm PT (4 runs/day, staggered 1hr after Main)
- **Data Source**: Firestore `direct_sales_contacts` collection
- **Control Variable**: CONTACTS_CAMPAIGN_ENABLED (separate from Main)
- **Batch Size**: Dynamic via Firestore `config/emailCampaign.batchSize` (shares with Main)
- **Subject**: "Using AI to Build Your {Company} Team" (company-specific)
- **Template Variables**: `first_name`, `company`, `tracked_cta_url`, `unsubscribe_url`
- **ABCD Test**: v3/v4/v5/v6 template rotation (v5/v6 are company-specific subject lines)

### Yahoo Campaign (REMOVED - Jan 2026)
- **Status**: REMOVED - File and function deleted
- **Purpose**: Was separate campaign for Yahoo/AOL email addresses
- **Data Source**: Was Firestore `emailCampaigns/master/contacts_yahoo` collection

### Automated Domain Warming System
- **Workflow**: `.github/workflows/domain-warming-update.yml`
- **Config**: `.github/warming-config.json`
- **Schedule**: Runs every Monday at 6am PT
- **Mechanism**: GitHub Actions calculates current week, looks up batch size from config, updates Firestore
- **Firestore Config**: `config/emailCampaign` document stores `batchSize`, `warmingWeek` (legacy `batchSizeYahoo` field unused after Yahoo campaign removal)
- **TBP Warming Schedule** (started 2026-01-12, 8 runs/day total):
  | Week | Batch Size | Emails/Day |
  |------|------------|------------|
  | 1 | 6 | 48 |
  | 2 | 12 | 96 |
  | 3 | 25 | 200 |
  | 4 | 50 | 400 |
  | 5 | 75 | 600 |
  | 6+ | 100 | 800 |
- **Manual Override**: `workflow_dispatch` with `force_week` input to test specific week

### Campaign Tracking
- **Sent/Failed/Remaining**: Tracked in Firestore `emailCampaigns/master/contacts` (sent, status fields)
- **Click Tracking**: Firestore `clickedAt` timestamp via `trackEmailClick` Cloud Function endpoint
- **Open Tracking**: Disabled (tracking pixel removed for deliverability)
- **GA4 Campaign Traffic**: Filtered by `sessionMedium: 'email'` (UTM parameters in email links)
- **A/B Test Breakdown**: By `subjectTag` field (`mobile_first_v3`, `mobile_first_v4`); legacy tags (`not_opportunity`, `prebuild_advantage`) supported
- **Dashboards**: `email-stats.html` (email-focused) and `TBP-analytics.html` (unified analytics)

### Android Launch Campaign (REMOVED - Jan 2026)
- **Status**: REMOVED - Function deleted
- **Purpose**: Was for re-engaging contacts sent before Nov 12, 2025 Android launch

### Mailgun Event Sync (Legacy - Disabled)
- **Function**: `syncMailgunEvents` in `functions/email-campaign-functions.js`
- **Purpose**: Was used to sync Mailgun delivery/engagement data to Firestore before 24-hour log expiration
- **Status**: Disabled after SMTP migration (Jan 2026). Mailgun open/click tracking also disabled.
- **Current tracking**: Firestore-native via `trackEmailClick` Cloud Function endpoint

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

---

## 🔄 Recent Changes & Milestones

### Key Milestones (Nov 2025 - Feb 2026)

**App Launches & Localizations**
- ✅ **Google Play Store Launch** (Nov 12, 2025): Android app live
- ✅ **Multi-Language Websites** (Nov 21-30): Launched ES, PT, DE sites with full content parity
- ✅ **App Store Localizations** (Dec 2025): App names localized across iOS and Android
  - ES: "Team Build Pro: IA Equipo", PT: "Team Build Pro: IA Equipe", DE: "Team Build Pro: KI Team"

**Email Campaign Infrastructure**
- ✅ **Email Campaigns via Mailgun API**: Both Main and Contacts campaigns use Mailgun API with template versioning
  - Sending domain: `news.teambuildpro.com` with 10/10 mail-tester.com score (SPF/DKIM/DMARC configured)
  - Open tracking disabled for deliverability; click tracking via Firestore `trackEmailClick` endpoint
  - SMTP sender utility (`email-smtp-sender.js`) exists but is used only for blog notifications, not campaigns
- ✅ **A/B Testing Active**: V3/V4 "Using AI to Build Your Team" (strict alternation with `mobile_first_v3`/`mobile_first_v4` tags)
- ✅ **A/B Test Template Update** (Jan 28, 2026): Migrated from v1/v2 to v3/v4 Mailgun templates
  - Subject changed from "Not an opportunity" / "What if your next recruit" to unified "Using AI to Build Your Team"
  - New subjectTags: `mobile_first_v3`, `mobile_first_v4` (dashboard supports both new and legacy tags)
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
- ✅ **Analytics Dashboards Migrated to Firestore**: Both `email-stats.html` and `TBP-analytics.html` now use Firestore for email stats (sent/failed/clicked/A/B test) and GA4 filtered by `sessionMedium: 'email'` for website traffic.

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

**Automation Systems**
- ✅ **Automated Blog Generation**: Twice-weekly (Mon/Thu) via GitHub Actions + Claude CLI
  - Generates posts in EN, ES, PT, DE
  - Auto-deploys to Firebase Hosting
  - Pings Google and Bing sitemaps after deploy
  - Scripts: `generate-ai-blog.js`, `generate-sscott-blog.js`
- ✅ **PreIntake.ai Workflows**: Bar scrapers + email campaign + analytics (see `preintake/CLAUDE.md`)

**Website Enhancements**
- ✅ **Prospect/Referral Page Consolidation** (Feb 6, 2026): All user types now handled on `index.html`
  - Deleted: `prospects.html` and `professionals.html` (all 4 languages)
  - `?new=` users: "Invited by" bar, hidden professionals section, TBP_Prospects.mp4, prospect headline
  - `?ref=` users: "Recommended by" bar, full page content, TBP_Professionals.mp4
  - Updated `components.js` logo links to route `?new=` to `/?new=` instead of `/prospects.html?new=`
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

### Current System Status (Feb 2026)

**PROJECT STATUS: MONITORING PHASE (as of Jan 31, 2026)**
Active development paused to allow automated systems to run and collect meaningful data. All infrastructure is self-sustaining. Revisit in 6-8 weeks (mid-March 2026) when domain warming completes and sufficient conversion data exists for optimization decisions.

| Component | Status | Notes |
|-----------|--------|-------|
| Main Campaign | Active | 8am, 11am, 2pm, 5pm PT (4 runs/day) |
| Contacts Campaign | Active | 9am, 12pm, 3pm, 6pm PT (4 runs/day) |
| Email Sending | Mailgun API | Via Mailgun, news.teambuildpro.com |
| Email A/B Testing | Active | V3/V4 strict alternation ("Using AI to Build Your Team") |
| Yahoo Campaign | Removed | File and function deleted (Jan 31) |
| Android Campaign | Removed | Function deleted (Jan 31) |
| Email Tracking | Firestore | Clicks via trackEmailClick; opens disabled |
| Analytics Dashboards | Firestore + GA4 | Top Countries + Yesterday + Today date ranges |
| Push Notifications | Working | profile_reminder, trial_expired verified |
| Blog Automation | Running | Mon/Thu schedule, 4 languages, sitemap pings |
| Sitemap Pings | Active | Google + Bing pinged after each blog deploy |
| Domain Warming | Week 4 | batchSize=50, 400 emails/day (8 runs total) |
| URL Discovery | Active | Every 2h, 120 companies/batch (processing 1,082 companies) |
| Contacts Seeder | Active | Every 4h, 3 sources (Common Crawl + Wayback + crt.sh) |
| Contacts Scraper | Active | Hourly, 400 URLs/batch, 12 blocked platforms |
| PreIntake.ai | Autonomous | See `preintake/CLAUDE.md` for details |

**Monitoring Checklist (Weekly):**
- [ ] Email click rates via `/email-stats.html`
- [ ] Traffic sources in `/TBP-analytics.html`
- [ ] App store downloads (iOS/Android tabs)
- [ ] Google Search Console for blog indexing

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
