# Team Build Pro - Comprehensive Knowledge Base

**Last Updated**: 2025-12-14
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
| **Legacy Brand** | https://teambuildingproject.com | Content hub with evergreen pillar pages on team-building principles |

### Cross-Linking Strategy

All ecosystem components are interconnected:
- **Website → App Stores**: Direct download links on every page
- **App → Websites**: Share screen generates language-specific referral URLs
- **Author Site → App**: Book pages link to Team Build Pro as the "tool that implements the strategies"
- **Legacy Brand → App**: teambuildingproject.com pillar pages include CTAs to Team Build Pro
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
- **Available worldwide** wherever App Store and Google Play operate (with timezone-aware features)
- **Works with any direct sales company** (company-agnostic platform)
- **$6.99/month** after 30-day free trial
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
├── tbp-project/           # teambuildingproject.com content hub
│   └── public/           # Static site with pillar pages
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
- Description: "Recruit smarter & empower your downline with AI. Pre-written messages, 24/7 coaching, real-time tracking. Free 30-day trial. $6.99/mo after."
- Hreflang tags linking all language versions
- JSON-LD schemas for organization and app

---

## Email Campaigns

### Campaign Architecture Overview

**Mailgun Configuration:**
- **Template Name**: `mailer`
- **Template Versions**: `initial` (text-based personal style), `simple` (image-based with hero)
- **Subject Lines (A/B)**: Alternates between two subject lines per batch
  - "Building Your Downline With AI"
  - "The Recruiting App Built for Direct Sales"
- **From**: `Stephen Scott <stephen@mailer.teambuildpro.com>`
- **Domain**: mailer.teambuildpro.com (warmup started Dec 5, 2025)
- **Tracking**: UTM parameters for GA4 (Mailgun open tracking unreliable due to Gmail pre-fetch)

### Main Campaign (Mailgun - Automated)
- **Function**: `sendHourlyEmailCampaign` in `functions/email-campaign-functions.js`
- **Schedule**: 8am, 10am, 12pm, 2pm, 4pm, 6pm PT (even hours)
- **Data Source**: Firestore `emailCampaigns/master/contacts` collection
- **Control Variable**: EMAIL_CAMPAIGN_ENABLED
- **Batch Size**: EMAIL_CAMPAIGN_BATCH_SIZE (currently 12)
- **A/B Testing**: 50/50 alternating between `initial` and `simple` templates
- **UTM Tracking**: `utm_source=mailgun`, `utm_medium=email`, `utm_campaign=initial_campaign`, `utm_content=[template]`

### Yahoo Campaign (Mailgun - Automated)
- **Function**: `sendHourlyEmailCampaignYahoo` in `functions/email-campaign-functions-yahoo.js`
- **Schedule**: 7am, 9am, 11am, 1pm, 3pm, 5pm PT (odd hours)
- **Data Source**: Firestore `emailCampaigns/master/contacts_yahoo` collection
- **Control Variable**: EMAIL_CAMPAIGN_ENABLED_YAHOO
- **Batch Size**: EMAIL_CAMPAIGN_BATCH_SIZE_YAHOO (currently 6)
- **A/B Testing**: Same as main campaign (initial/simple templates)
- **UTM Tracking**: `utm_source=mailgun`, `utm_medium=email`, `utm_campaign=yahoo_campaign`, `utm_content=[template]`

### Mailgun Event Sync (Automated)
- **Function**: `syncMailgunEvents`
- **Purpose**: Sync delivery/engagement data to Firestore before 24-hour log expiration
- **Schedule**: 10 minutes after each campaign window
- **Event Types**: delivered, failed, opened, clicked

### Email Analytics (GA4)
- **Script**: `analytics/fetch-email-campaign-analytics.js`
- **Purpose**: Track actual email click-through via GA4 (bypasses Gmail pre-fetch inflation)
- **Run Command**: `GOOGLE_APPLICATION_CREDENTIALS="../secrets/ga4-service-account.json" npm run fetch-email`
- **Filters**: `utm_source=mailgun` to isolate email traffic
- **Reports**: Campaign overview, template A/B results, daily trends, landing page performance

### Email Strategy
1. **Landing Page CTA** (not direct app store links) - enables analytics/retargeting
2. **Subtle Text Links** (not buttons) - less "markety" for pitch-fatigued audience
3. **Personal, Simple Style** - builds trust through restraint
4. **GA4 for True Metrics** - Mailgun open rates inflated by Gmail security pre-fetch (80-95% fake opens)

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

### App Preview Videos (iOS)
- **3 preview videos** per localization (EN, ES, PT, DE = 12 total)
- **Format**: 886x1920 (6.7" iPhone portrait), H.264 baseline, 30fps
- **Audio**: Silent AAC track (required by App Store)
- **Source script**: `scripts/export-photos-for-appstore.sh`

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
- `scripts/cleanup_caches.sh` - Comprehensive dev cache cleanup (Xcode, Flutter, CocoaPods, Gradle, simulators)
- `functions/get-mailgun-stats.js` - Mailgun statistics by tag
- `functions/count-todays-emails.js` - Daily email counts
- `analytics/fetch-email-campaign-analytics.js` - GA4 email campaign performance report

---

## Recent Updates (December 2025)

### Week of Dec 14
- **Profile Completion Reminder Notifications**: Added automated push reminders for incomplete profiles
  - New scheduled function: `sendProfileCompletionReminders` (runs hourly)
  - Sends reminders at 24h, 72h, and 7 days after registration
  - Targets users where `isProfileComplete !== true`
  - Tracks sent reminders via `profile_reminder_24h`, `profile_reminder_72h`, `profile_reminder_168h` flags
  - Deep links to `/edit-profile` route on notification tap
  - Added translations for EN, ES, PT, DE in `functions/translations.js`
- **Beta Testing Cleanup**: Removed 10 beta/demo functions from Firebase (Google Play beta complete)
  - Deleted: `grantBetaTesterLifetimeAccess`, `revokeBetaTesterLifetimeAccess`, `getBetaTesterStats`, `generateBetaTesterCSVs`, `addToDemoLeads`, `appendDemoEmail`, `addToDemoQueue`, `getDemoCount`, `sendDemoInvitation`, `sendDemoNotification`
  - Function files preserved in codebase for reference
  - Removed exports from `functions/index.js`
- **App Store CTA Sponsor Tracking**: Added Universal Link fallback to preserve sponsor info on blog/company pages
  - Added `openAppOrStore()` function to `components.js` with locale-aware routing
  - Updated 330 blog/company pages with `onclick="openAppOrStore('ios'); return false;"` handlers
  - iOS users redirected through `/claim.html` to preserve `?ref=`/`?new=` params
  - Script: `scripts/add-app-store-onclick.js` for future maintenance
  - Updated `scripts/generate-ai-blog.js` to include onclick handlers in new blog CTAs
- **Language Switcher Sponsor Preservation**: Fixed sponsor referral loss when switching languages
  - Problem: `sessionStorage` doesn't work across subdomains, and `ref`/`new` params were being stripped
  - Solution: Keep `ref`/`new` params in URL, use `/index.html` instead of `/` to bypass Universal Links
  - `checkReferralRouting()` in index.html handles redirect to correct page (professionals/prospects)
- **AASA Files for Locale Sites**: Added `apple-app-site-association` to ES, PT, DE sites
  - Enables Universal Link support on all locale domains
  - Required for `openAppOrStore()` locale-aware routing to work properly
- **Internal Link Audit**: Created comprehensive link validation tool
  - New script: `scripts/audit-internal-links.js` - scans all 4 locales (382 HTML files, 9,368 links)
  - Fixed broken link in EN blog: `30-day-pre-qualification-system.html` → `qualify-new-recruits-30-days.html`
  - Skips backup files (`*-back.html`, `*-test.html`, etc.)
- **Header Standardization**: Converted `web/blog.html` to use `components.js`
  - Removed inline header with "Screenshots" menu item
  - All 4 locale blog pages now use consistent `components.js` header/footer
  - Removed duplicate mobile menu JavaScript from ES, PT, DE blog pages
- **Podcast SEO Schema**: Added AudioObject schema.org structured data
  - `PODCAST_SCHEMA_JSON_LD` generator in `scripts/podcast-config.js`
  - Auto-injects JSON-LD schema into `<head>` when podcasts are generated
  - Enables Google rich snippets and audio-enhanced search results
- **Firebase Storage Bucket Fix**: Corrected bucket name in podcast-config.js
  - Changed from `.appspot.com` to `.firebasestorage.app`
- **Generated Podcasts**: Created podcasts for 2 most recent blogs
  - "The Death of Cold Messaging" and "How AI is Revolutionizing MLM Recruiting"
  - Generated in EN, ES, PT (DE pending Jan 13 credit reset)
- **Cleanup**: Removed obsolete `index-back.html` backup files from all 4 locales
- **Synced components.js**: Ensured all locale sites have updated `components.js` with latest fixes

### Week of Dec 13
- **Podcast Automation for Blogs**: Added ElevenLabs TTS podcast generation to blog automation pipeline
  - New scripts: `scripts/generate-podcasts.js` (main engine), `scripts/podcast-config.js` (voice settings)
  - Integration with `generate-ai-blog.js` - automatically generates podcasts after blog creation
  - Languages: EN, ES, PT only until Jan 13, 2026 credit reset (DE pending)
  - ElevenLabs Creator tier: 140,000 chars/month, ~4,500 chars per podcast
  - Audio files uploaded to Firebase Storage: `gs://teambuilder-plus-fe74d.firebasestorage.app/podcasts/[lang]/[slug].mp3`
  - Podcast player CSS added to all 4 locale stylesheets
  - GitHub Actions workflow updated with ELEVENLABS_API_KEY secret
- **Hero Section Text Update**: Updated hero subline messaging on index.html and professionals.html (all 4 locales)
  - New: "Prospects pre-build teams before joining. Professionals give their team AI-powered duplication tools. Everyone builds momentum."
  - Translations provided for ES, PT, DE
- **Balanced Hero Headlines**: Added `<br class="desktop-only">` for balanced 2-line layout on desktop
  - Break point after "with/con/com/mit" to emphasize "AI tools" on line 2
  - CSS hides break on mobile (<768px) for natural word wrapping
- **Language Switcher Universal Links Fix**: Fixed language switcher triggering app instead of website navigation
  - Root cause: `?ref=` and `?new=` params in language links matched Universal Links pattern
  - Initial solution: Strip params (superseded by Dec 14 fix that preserves params using `/index.html` path)
- **Mobile Menu Fix**: Fixed non-responsive hamburger menu in EN blog.html
  - Changed `classList.toggle('active')` to `classList.toggle('open')` to match CSS selector
- **teambuildingproject.com Content Hub**: Transformed legacy brand site from simple landing page into SEO content property
  - Created 5 evergreen pillar pages focused on "Timeless Team-Building Wisdom" (Est. 2009 heritage)
  - Pages: `why-recruits-quit.html`, `five-principles.html`, `duplication-problem.html`, `success-timeline.html`, `building-trust.html`
  - Each page includes CTA boxes linking to Team Build Pro app
  - Shared CSS (`css/style.css`) with consistent navigation and styling
  - Updated homepage with "Team Building Insights" section listing all articles
- **Legacy URL Cleanup**: Configured robots.txt and firebase.json to handle ~106 legacy WordPress URLs
  - Added Disallow rules for `/blog/`, `/category/`, `/tag/`, `/page/`, `/wp-content/`, etc.
  - Created custom 404.html page with `noindex, nofollow` meta tag
  - Added rewrites in firebase.json to serve 404 for legacy URL patterns
  - Sitemap updated with 6 valid pages only

### Week of Dec 12
- **Video Lightbox on Company Pages**: Added "Watch 60-Second Video" text link to all 3 CTAs on 287 company pages
  - Clicking link opens modal lightbox with TBP_Professionals.mp4 video
  - Localized link text: EN "Watch 60-Second Video", ES "Ver Video de 60 Segundos", PT "Assistir Vídeo de 60 Segundos", DE "60-Sekunden-Video ansehen"
  - CSS in `web/css/style.css`, JS in `web/js/components.js`
  - Scripts: `scripts/add-video-lightbox.js`, `scripts/fix-video-lightbox.js`, `scripts/add-video-link-all-ctas.js`
- **Smart Language Switcher**: Fixed language switcher to only show links for pages that actually exist
  - Added `data-available-langs` attribute to all company page `<html>` tags (e.g., `data-available-langs="en,es,pt"`)
  - Updated `components.js` to filter language options based on this attribute
  - Prevents 404 errors when PT (39 pages) or DE (20 pages) don't have all EN/ES company pages (114 each)
  - Script: `scripts/add-available-langs.js`
- **SEO Meta Description Update**: Updated meta descriptions on all 287 company pages
  - Changed from generic "AI recruiting playbook..." to benefit-focused "Grow your {Company} team with AI..."
  - Script: `scripts/update-meta-descriptions.js`
- **Firebase Redirect Fix**: Removed broken redirect rules from firebase.json that caused infinite `.html.html.html...` loops

### Week of Dec 10
- **App Store Preview Videos**: Added 3 preview videos to each iOS localization (EN, ES, PT, DE = 12 total)
  - Format: 886x1920 (6.7" iPhone), H.264 baseline, 30fps, silent AAC audio track
  - Created `scripts/export-photos-for-appstore.sh` for video conversion
  - App Store requires audio track (even silent) or shows "corrupted audio" error
- **GA4 Internal Traffic Filter**: Updated IPv6 filter from `2603` to `2603:8000:7ff0:4830` (household /64 prefix)
- **Email Campaign UTM Tracking**: Added GA4 UTM parameters to bypass unreliable Mailgun open tracking
  - Mailgun templates (`initial`, `simple`) updated with dynamic UTM variables
  - Cloud Functions pass `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` to templates
  - Gmail pre-fetches tracking pixels causing 80-95% fake open rates - now using GA4 for true metrics
- **Email A/B Testing Restored**: Switched back to `initial` vs `simple` template testing (was initially/click_driver)
- **GA4 Email Analytics Script**: Created `analytics/fetch-email-campaign-analytics.js`
  - Filters by `utm_source=mailgun` to isolate email traffic
  - Reports template A/B results via `utm_content` dimension
  - Run: `GOOGLE_APPLICATION_CREDENTIALS="../secrets/ga4-service-account.json" npm run fetch-email`
- **Batch Size Increase**: Main campaign increased from 10 to 12 per batch (domain warmup progressing)
- **Disk Cleanup Script Enhanced**: Updated `scripts/cleanup_caches.sh` with additional cleanup routines
  - Added Xcode DocumentationCache, CoreDeviceService cache, Archives cleanup
  - Added Homebrew cache cleanup, leftover DMG removal
  - Added simulator erase to clear MobileAsset (Siri/TTS) data
  - Added Flutter dependency restoration (flutter clean, pub get, pod install)

### Week of Dec 8
- **HeyGen Video Scripts**: Created localized video scripts for Professionals and Prospects landing pages in ES, PT, DE
- **Video Embedding (All Sites)**: Embedded TBP_Professionals.mp4 and TBP_Prospects.mp4 videos on all 4 locale sites
  - Files: index.html, professionals.html, prospects.html (EN, ES, PT, DE = 12 pages)
  - Video paths: `/assets/videos/TBP_Professionals.mp4` and `/assets/videos/TBP_Prospects.mp4`
  - CSS: `.section-video`, `.video-headline`, `.video-container`, `.video-subtext`
- **Video Thumbnails**: Added `poster="/assets/videos/Thumbnail.png"` attribute to all 12 video elements
  - Custom thumbnail image displays before video plays
  - Thumbnail.png copied to all 4 locale assets/videos/ folders

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
- **Revenue Model**: Subscription ($6.99/month after 30-day trial)
- **Target Market**: Direct sales professionals and their prospects
- **Competitive Advantage**: Only platform enabling pre-building teams before joining
- **Distribution**: iOS App Store, Google Play Store

---

*This knowledge base should be referenced at the start of each new AI assistant session to maintain context and understanding of Team Build Pro.*
- reminde me on January 13, 2026 to do the following: After Jan 13, 2026:
  - Re-enable DE in the loop
  - Backfill all existing blogs with podcasts