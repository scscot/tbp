# Team Build Pro - Comprehensive Knowledge Base

**Last Updated**: 2025-12-06
**Purpose**: Persistent knowledge base for AI assistants across sessions

---

## Team Build Pro Ecosystem

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

### Cross-Linking Strategy

All ecosystem components are interconnected:
- **Website → App Stores**: Direct download links on every page
- **App → Websites**: Share screen generates language-specific referral URLs
- **Author Site → App**: Book pages link to Team Build Pro as the "tool that implements the strategies"
- **Email → Website → App**: Landing page routing for analytics and retargeting
- **Blog → App**: Every post includes "Get the App" CTA sections
- **Company Pages → App**: Tailored messaging for each company's audience

---

## Core Product Identity

### What is Team Build Pro?
**Team Build Pro is an AI Downline Builder** - a professional software tool (NOT a business opportunity or MLM company) that helps direct sales professionals build, manage, and track their downline before and during their business journey.

### Key Differentiator
The world's first AI-powered platform that lets **prospects pre-build their teams BEFORE joining a business opportunity**, creating momentum from Day 1 and eliminating the cold-start problem that causes 75% of recruits to quit in their first year.

---

## Critical Statistics

- **75% of recruits quit in their first year** (primary pain point)
- **16 pre-written messages** (8 for recruiting prospects + 8 for existing business partners)
- **24/7 AI Coach** for instant recruiting guidance in 4 languages
- **4 languages supported**: English, Spanish (Español), Portuguese (Português), German (Deutsch)
- **4 direct sponsors + 20 total downline members** = qualification milestones
- **120+ countries supported** with timezone-aware features
- **100+ direct sales companies** compatible
- **$4.99/month** after 30-day free trial
- **70% performance improvement** through client-side caching

---

## Technical Architecture

### Platform
- **Frontend**: Flutter (Dart) for iOS and Android
- **Backend**: Firebase (Firestore, Cloud Functions v2, Authentication, Remote Config)
- **Functions**: 50+ Cloud Functions handling real-time operations
- **Hosting**: Firebase Hosting for web properties
- **Email**: Mailgun for all email delivery (campaigns and launch announcements)

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
├── .github/workflows/     # GitHub Actions automation
│   └── weekly-blog.yml    # Twice-weekly blog automation (Mon/Thu 10am PST)
├── web/                   # Public website files (English)
│   ├── index.html        # Homepage
│   ├── faq.html          # FAQ with dynamic filtering
│   ├── books.html        # Books landing page
│   ├── professionals.html # Audience page for direct sales reps
│   ├── prospects.html    # Audience page for new recruits
│   ├── companies/        # Company-specific recruiting guides (120+ pages)
│   ├── blog/             # Blog posts (10+ articles)
│   └── js/components.js  # Shared header/footer component
├── web-es/                # Spanish website (es.teambuildpro.com)
├── web-pt/                # Portuguese website (pt.teambuildpro.com)
├── web-de/                # German website (de.teambuildpro.com)
├── sscott/                # Stephen Scott author website (stephenscott.us)
├── scott-net/             # stephen-scott.net redirect site
├── analytics/             # Analytics workspace (GA4 + Mailgun)
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
- `?new=ABC` = Prospect view (considering joining referrer's opportunity)
- `?ref=ABC` = Professional view (existing team member)
- Referral codes map to Firebase UIDs via `referralCodes` collection
- Language-specific domains: es.teambuildpro.com (Spanish), pt.teambuildpro.com (Portuguese), de.teambuildpro.com (German)
- Share screen uses language selection to route to appropriate domain

---

## Messaging & Positioning

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

## Website Structure

### Multi-Language Website Architecture

#### Hosting Structure (6 Sites)
- **English**: teambuildpro.com (web/) - Primary site
- **Spanish**: es.teambuildpro.com (web-es/) - Complete Spanish translation
- **Portuguese**: pt.teambuildpro.com (web-pt/) - Complete Portuguese translation
- **German**: de.teambuildpro.com (web-de/) - Complete German translation
- **Author**: stephenscott.us (sscott/) - Stephen Scott author website
- **Redirect**: stephen-scott.net (scott-net/) - 301 redirects to stephenscott.us
- **Firebase Hosting**: Six separate targets with individual configs

#### Language Switcher Implementation
- **Location**: Top-right of header on all pages
- **Functionality**: Switches between EN/ES/PT/DE versions
- **Query String Preservation**: Maintains `?new=` and `?ref=` parameters across language switches
- **Mobile Optimized**: Responsive positioning for all screen sizes

#### Complete Content Parity (EN, ES, PT, DE)
All four main sites have identical structure:
- Homepage with hero section
- FAQ page (8 questions)
- Books landing page with localized covers
- Blog index with translated posts
- Professionals page (audience-specific)
- Prospects page (audience-specific)
- Company recruiting guides (120+ EN, 114 ES, 39 PT, 20 DE)
- Privacy policy, Terms of service, Contact form
- delete-account.html (App Store compliance)
- Sitemap.xml and robots.txt for SEO

### Key Pages (All Languages)
- `/` - Homepage
- `/faq.html` - Dynamic FAQ
- `/books.html` - Books landing page
- `/blog.html` - Blog index
- `/professionals.html` - For direct sales reps
- `/prospects.html` - For new recruits
- `/companies.html` - Company recruiting guides index
- `/companies/ai-recruiting-[company].html` - Individual company pages
- `/contact_us.html` - Contact form
- `/delete-account.html` - Account deletion (App Store requirement)
- `/privacy_policy.html` - Privacy policy
- `/terms_of_service.html` - Terms of service

### SEO & Meta Tags
- Title: "AI Downline Builder - Recruit Smarter, Build Faster"
- Description: "Recruit smarter & empower your downline with AI. Pre-written messages, 24/7 coaching, real-time tracking. Free 30-day trial. $4.99/mo after."
- Hreflang tags linking all language versions
- JSON-LD schemas for organization and app

---

## Email Campaigns

### Campaign Architecture Overview

**Mailgun Configuration:**
- **Template Name**: `campaign`
- **Template Versions**: `initial` (personal style), `click_driver` (CTA-focused)
- **Subject Line**: `The Recruiting App Built for Direct Sales`
- **From**: `Stephen Scott <ss@mailer.teambuildpro.com>`
- **Domain**: mailer.teambuildpro.com
- **Tracking**: Opens, clicks, and delivery status enabled

### Main Campaign (Mailgun - Automated)
- **Function**: `sendHourlyEmailCampaign` in `functions/email-campaign-functions.js`
- **Schedule**: 8am, 10am, 12pm, 2pm, 4pm, 6pm PT (even hours)
- **Data Source**: Firestore `emailCampaigns/master/contacts` collection
- **Control Variable**: EMAIL_CAMPAIGN_ENABLED
- **Batch Size**: EMAIL_CAMPAIGN_BATCH_SIZE (currently 6)
- **A/B Testing**: 50/50 alternating between 'initial' and 'click_driver' templates

### Yahoo Campaign (Mailgun - Automated)
- **Function**: `sendHourlyEmailCampaignYahoo` in `functions/email-campaign-functions-yahoo.js`
- **Schedule**: 7am, 9am, 11am, 1pm, 3pm, 5pm PT (odd hours)
- **Data Source**: Firestore `emailCampaigns/master/contacts_yahoo` collection
- **Control Variable**: EMAIL_CAMPAIGN_ENABLED_YAHOO
- **Batch Size**: EMAIL_CAMPAIGN_BATCH_SIZE_YAHOO (currently 6)

### Mailgun Event Sync (Automated)
- **Function**: `syncMailgunEvents`
- **Purpose**: Sync delivery/engagement data to Firestore before 24-hour log expiration
- **Schedule**: 10 minutes after each campaign window
- **Event Types**: delivered, failed, opened, clicked

### Email Strategy
1. **Landing Page CTA** (not direct app store links) - enables analytics/retargeting
2. **Subtle Text Links** (not buttons) - less "markety" for pitch-fatigued audience
3. **Personal, Simple Style** - builds trust through restraint

---

## App Store Listing

**App Name**: Team Build Pro: Direct Sales
**App ID (iOS)**: 6751211622
**Package ID (Android)**: com.scott.ultimatefix
**Status**: LIVE on both iOS App Store and Google Play Store

### App Store URLs
- **iOS**: https://apps.apple.com/us/app/id6751211622
- **Android**: https://play.google.com/store/apps/details?id=com.scott.ultimatefix
- **Website**: https://teambuildpro.com

### Localized App Names
- **English**: Team Build Pro: Direct Sales
- **Spanish**: Team Build Pro: IA Equipo
- **Portuguese**: Team Build Pro: IA Equipe
- **German**: Team Build Pro: KI Team

---

## Development Workflow

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

## Critical Don'ts

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

---

## Key Source Files

- `lib/main.dart` - App initialization
- `lib/services/auth_service.dart` - Authentication
- `lib/services/network_service.dart` - Advanced caching
- `lib/screens/share_screen.dart` - 16 pre-written messages
- `lib/screens/dashboard_screen.dart` - Main dashboard
- `lib/l10n/app_*.arb` - Localization files (EN, ES, PT, DE)
- `functions/index.js` - All Cloud Functions
- `functions/email-campaign-functions.js` - Automated email campaigns
- `web/js/components.js` - Shared header/footer component

### Utility Scripts
- `scripts/generate-ai-blog.js` - AI blog generation (Claude CLI)
- `functions/get-mailgun-stats.js` - Mailgun statistics
- `functions/count-todays-emails.js` - Daily email counts

---

## Recent Updates (December 2025)

### Week of Dec 6
- **Email A/B Testing**: Added click_driver.html template with prominent CTAs; 50/50 distribution between 'initial' and 'click_driver'
- **Batch Size Update**: Updated to 6/6 for even A/B distribution
- **Homepage Simplification**: Removed carousel JavaScript, simplified sections across EN/ES/PT/DE
- **delete-account.html**: Created for ES, PT, DE sites (App Store compliance)
- **Portuguese Typo Fix**: Fixed "Inicio" → "Início" in 9 company pages
- **Audience Pages**: Created professionals.html and prospects.html for all 4 sites
- **components.js**: Created shared header/footer component for all sites

### Week of Dec 5
- **Google Search Console Cleanup**: Added robots.txt rules for stephenscott.us legacy WordPress URLs
- **DNS Fix for stephenscott.us**: Removed old Dreamhost IP, SSL now working
- **Project Archive Script**: Created scripts/create-project-zip.sh

### Week of Dec 2
- **App Version 1.0.70+100 Approved**: Full ES, PT, DE localizations live on both stores
- **SMTP Email Validation**: Validated 18,334 Gmail addresses (89.3% valid)
- **Firestore Import**: 13,298 new SMTP-validated contacts imported
- **Cross-Page Referral Tracking**: Added referral-tracking.js to all pages
- **Site-Wide Invite Bar**: Shows sponsor info on all pages (328 files updated)
- **App Store URL Standardization**: Changed to simplified format across 328 files

---

## Contact & Support

- **Creator**: Stephen Scott (sscott@info.teambuildpro.com)
- **Support Email**: support@teambuildpro.com
- **GitHub**: Private repository
- **Firebase Project**: teambuilder-plus-fe74d

---

## Business Model

**NOT a business opportunity** - Team Build Pro is a B2B SaaS tool:
- **Revenue Model**: Subscription ($4.99/month after 30-day trial)
- **Target Market**: Direct sales professionals and their prospects
- **Competitive Advantage**: Only platform enabling pre-building teams before joining
- **Distribution**: iOS App Store, Google Play Store

---

*This knowledge base should be referenced at the start of each new AI assistant session to maintain context and understanding of Team Build Pro.*
