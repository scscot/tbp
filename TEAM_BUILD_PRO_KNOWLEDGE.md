# Team Build Pro - Comprehensive Knowledge Base

**Last Updated**: 2025-11-24
**Purpose**: Persistent knowledge base for AI assistants across sessions

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
- **$4.99/month** after 30-day free trial
- **70% performance improvement** through client-side caching
- **30.9% email open rate** - 2x industry average for cold email campaigns

---

## 🏗️ Technical Architecture

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
├── web/                   # Public website files (English)
│   ├── index.html        # Homepage
│   ├── faq.html          # FAQ with dynamic filtering
│   ├── books.html        # Books landing page
│   ├── companies/        # Company-specific recruiting guides (120+ pages)
│   └── blog/             # Blog posts (6 articles)
├── web-es/                # Spanish website (es.teambuildpro.com)
│   ├── index.html        # Spanish homepage
│   ├── faq.html          # Spanish FAQ
│   ├── books.html        # Spanish books page
│   ├── blog/             # Spanish blog (6 translated posts)
│   ├── sitemap.xml       # Spanish sitemap
│   └── robots.txt        # Spanish search engine directives
├── web-pt/                # Portuguese website (pt.teambuildpro.com)
│   ├── index.html        # Portuguese homepage
│   ├── faq.html          # Portuguese FAQ
│   ├── books.html        # Portuguese books page
│   ├── blog/             # Portuguese blog (6 translated posts)
│   ├── sitemap.xml       # Portuguese sitemap
│   └── robots.txt        # Portuguese search engine directives
├── sscott/                # Stephen Scott author website (stephenscott.us)
│   ├── public/           # Author site pages (migrated from Dreamhost to Firebase)
│   │   ├── index.html   # Author homepage
│   │   ├── books.html   # Author books catalog
│   │   ├── books/       # 13 individual book pages
│   │   ├── podcasts.html # Podcast listings
│   │   └── blog.html    # Author blog
│   └── scripts/         # Build automation scripts
├── analytics/             # Analytics workspace (GA4 + Mailgun)
│   ├── fetch-combined-analytics.js  # Combined reporting
│   ├── fetch-ga4-data.js           # Google Analytics 4 data
│   └── package.json                # Analytics dependencies
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
- Language-specific domains: es.teambuildpro.com (Spanish), pt.teambuildpro.com (Portuguese)
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

#### Hosting Structure (4 Sites)
- **English**: teambuildpro.com (web/) - Primary site
- **Spanish**: es.teambuildpro.com (web-es/) - Complete Spanish translation
- **Portuguese**: pt.teambuildpro.com (web-pt/) - Complete Portuguese translation
- **Author**: stephenscott.us (sscott/) - Stephen Scott author website (migrated from Dreamhost)
- **Firebase Hosting**: Four separate targets (main, es, pt, sscott) with individual configs

#### Language Switcher Implementation
- **Location**: Top-right of header on all pages
- **Functionality**: Switches between EN/ES/PT versions
- **Query String Preservation**: Maintains `?new=` and `?ref=` parameters across language switches
- **Mobile Optimized**: Responsive positioning for all screen sizes
- **Smart Routing**: Directs to corresponding page in target language

#### Complete Content Parity (EN, ES, PT)
All three main sites have identical structure:
- Homepage with hero animation
- FAQ page (8 questions)
- Books landing page with localized covers
- Blog index with 6 translated posts
- Privacy policy
- Terms of service
- Contact form
- Sitemap.xml for SEO
- Robots.txt for search engine directives

#### SEO Optimization
- **Hreflang Tags**: Cross-reference all language versions
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
- `/blog/` - 6 blog posts:
  - ai-automation-transforms-direct-sales.html
  - ai-recruiting-best-practices-2025.html
  - ai-recruiting-platforms-failing-direct-sales.html
  - qualify-new-recruits-30-days.html
  - team-build-pro-november-2025-update.html
  - young-living-recruiting-strategies.html
- `/companies.html` - 120+ company-specific recruiting guides
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
- `/blog/` - 6 translated blog posts (same titles as EN)
- `/contact_us.html` - Spanish contact form
- `/privacy_policy.html` - Spanish privacy policy
- `/terms_of_service.html` - Spanish terms of service
- `/sitemap.xml` - Spanish sitemap with hreflang tags
- `/robots.txt` - Spanish search directives

### Portuguese Site (web-pt/ - pt.teambuildpro.com)
- `/` - Portuguese homepage with hero animation
- `/faq.html` - Portuguese FAQ (8 questions with accordion)
- `/books.html` - Portuguese books page (MLM-Cover-BR.jpg)
- `/blog.html` - Portuguese blog index
- `/blog/` - 6 translated blog posts (same titles as EN)
- `/contact_us.html` - Portuguese contact form
- `/privacy_policy.html` - Portuguese privacy policy
- `/terms_of_service.html` - Portuguese terms of service
- `/sitemap.xml` - Portuguese sitemap with hreflang tags
- `/robots.txt` - Portuguese search directives

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
- Description: "Recruit smarter & empower your downline with AI. Pre-written messages, 24/7 coaching, real-time tracking. Free 30-day trial. $4.99/mo after."
- Focus keywords: AI downline builder, pre-build teams, direct sales recruiting

---

## 🤖 Bot Detection & Traffic Analysis

### Comprehensive Bot Filtering System
- **Implementation**: JavaScript bot detection across all sites (EN, ES, PT, Author)
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
- **Dependencies**: Google Analytics Data API v1, Mailgun API integration
- **Environment**: Service account authentication (ga4-service-account.json)

### Core Analytics Functions

**fetch-combined-analytics.js** (511 lines)
- Combined GA4 + Mailgun reporting system
- Cross-references website traffic with email campaign performance
- Generates comprehensive analytics reports
- Correlates email engagement with website visits

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
- Email campaign performance metrics
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
- **iOS**: https://apps.apple.com/us/app/team-build-pro-ai-team-builder/id6751211622
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

### Current Campaign (Mailgun - Automated)
- **Function**: `sendHourlyEmailCampaign` in `functions/email-campaign-functions.js`
- **Subject**: `The Recruiting App Built for Direct Sales` (updated Nov 2025)
- **Template**: `2version` (Mailgun template variant)
- **CTA Strategy**: Landing page routing (https://teambuildpro.com) with subtle text link "Learn more at TeamBuildPro.com"
- **Schedule**: 8am, 10am, 12pm, 1pm, 3pm, 6pm PT, Monday-Saturday
- **Batch Size**: 75 emails per run (450 emails/day) - increased Nov 24
- **Domain**: info.teambuildpro.com
- **Data Source**: Firestore `emailCampaigns/master/contacts` collection
- **Independent Control**: EMAIL_CAMPAIGN_ENABLED environment variable

### Campaign Performance (as of Nov 2025)
- **Total Contacts**: 5,527
- **Total Sent**: 2,077 (37.6%)
- **Remaining**: 3,450 (62.4%)
- **Open Rate**: 30.9% (excellent - industry avg 15-25%)
- **Click Rate**: 5.5% (good - industry avg 2-3%)
- **Engagement Rate**: 36.4% (outstanding)
- **Delivery Rate**: 96.5% (2 failures out of 57 daily)
- **Completion Timeline**: ~28 days at current rate

### Android Launch Campaign (Mailgun - Automated Phase 2)
- **Function**: `sendAndroidLaunchCampaign` in `functions/email-campaign-functions.js`
- **Subject**: `The Recruiting App Built for Direct Sales` (same as Phase 1)
- **Template**: `resend` (Mailgun template variant for Android launch announcement)
- **Purpose**: Re-engage contacts sent before Nov 12, 2025 Android launch
- **Schedule**: Same as Phase 1 (8am, 10am, 12pm, 1pm, 3pm, 6pm PT, Monday-Saturday)
- **Batch Size**: Same as Phase 1 (75 emails per run)
- **Data Source**: Firestore `emailCampaigns/master/contacts` collection (resend field)
- **Independent Control**: ANDROID_CAMPAIGN_ENABLED environment variable (currently disabled)
- **Pre-marked Contacts**: 2,077 contacts marked with `resend: false` via mark-contacts-for-resend.js script
- **App Store URLs**: Correct URLs (fixed from incorrect com.teambuildpro.app to com.scott.ultimatefix)
- **Status**: Ready to deploy after Phase 1 completion

### Mailgun Event Sync (Automated Data Collection)
- **Function**: `syncMailgunEvents` in `functions/email-campaign-functions.js`
- **Purpose**: Sync Mailgun delivery/engagement data to Firestore before 24-hour log expiration
- **Schedule**: 10 minutes after each campaign window (8:10am, 10:10am, 12:10pm, 1:10pm, 3:10pm, 6:10pm PT)
- **Lookback Window**: 2 hours (captures events from previous campaign run)
- **Event Types**: delivered, failed, opened, clicked
- **Data Stored**: deliveryStatus, deliveredAt, failedAt, failureReason, openedAt, openCount, clickedAt, clickCount
- **Independent Control**: EMAIL_CAMPAIGN_SYNC_ENABLED environment variable
- **Batch Processing**: Handles up to 500 contacts per Firestore batch commit
- **API Limit**: 300 events per event type per query
- **Status**: Deployed and operational (Nov 24, 2025)

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
   - Proven with 30.9% open rate

3. **Personal, Simple Style**:
   - No complex hero images or heavy formatting
   - Personal tone from Stephen Scott
   - Focus on value and benefits
   - Works well with Mailgun's deliverability

### Target Audience
- Current direct sales professionals (not prospects)
- Cold email list sourced from MLM/direct sales databases
- Goal: Landing page visits → App downloads → Trial sign-ups → Paid conversions

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
- `functions/email-campaign-functions.js` - Automated hourly email campaign
- `functions/sendLaunchCampaign.js` - Manual launch announcement emails
- `functions/email_templates/launch_campaign_mailgun.html` - Launch email template
- `web/faq.html` - Dynamic FAQ implementation

### Utility Scripts (functions/)
- `count-todays-emails.js` - Query Firestore for daily email send counts
- `get-mailgun-stats.js` - Query Mailgun API for delivery/engagement statistics
- `test-email.js` - Send test emails via Mailgun for campaign testing
- `reset-failed-contacts.js` - Reset failed email campaign contacts from Mailgun CSV exports
- `reset_failed_batch.js` - Batch processing for failed contact resets
- `reset_failed_contacts.js` - Alternative reset script for email campaign recovery
- `mark-contacts-for-resend.js` - Mark all contacts sent before Nov 12, 2025 for Android launch resend campaign

---

## 🔄 Recent Major Changes (as of Nov 2025)

### Week of Nov 6
1. ✅ Updated FAQ with dynamic audience filtering (prospect vs professional)
2. ✅ Corrected message count from 8 to 16 throughout marketing materials
3. ✅ Fixed category dropdown filtering on FAQ page
4. ✅ Updated email campaign subject line and template
5. ✅ Standardized 75% quit rate statistic (was inconsistent)
6. ✅ Added "perpetual recruiting engine" messaging
7. ✅ Removed "proven/prove" language from messaging

### Week of Nov 12
8. ✅ **Google Play Store Launch**: App now LIVE on Android (completed Nov 12)
9. ✅ **Email CTA Strategy Update**: Changed from direct app store links to landing page routing
   - Updated both `email-body-only-updated.html` and `email-template-updated.html`
   - Implemented subtle text link CTA: "Learn more at TeamBuildPro.com"
   - Rationale: Better cross-device experience, enables analytics/retargeting
10. ✅ **Email Campaign Performance**: Achieving 30.9% open rate (2x industry average)
11. ✅ **Mailgun Conversion**: Converted `sendLaunchCampaign.js` from SendGrid to Mailgun
   - Created new `launch_campaign_mailgun.html` template
   - Updated function to use Mailgun API with FormData
   - Simplified personalization (uses Mailgun variable syntax)
12. ✅ **Campaign Statistics Tracking**: Created monitoring scripts
   - `count-todays-emails.js` for Firestore tracking
   - `get-mailgun-stats.js` for delivery/engagement metrics
13. ✅ **Website Updates**: Updated 115 company pages with Google Play Store link
14. ✅ **App Store URL Update**: Updated all 121 website files with new App Store URL
   - Changed from `team-build-pro-direct-sales` to `team-build-pro-ai-team-builder`
   - URL slug updated to reflect app name change in App Store Connect
   - Old URLs redirect automatically to new URLs (Apple's redirect behavior)
   - Best practice: Use current URL format for SEO and consistency

### Week of Nov 17
15. ✅ **Multilingual Screen Localization**: Fully localized How It Works and Platform Management screens
   - Added 31 new localization keys (18 for How It Works + 13 for Platform Management)
   - Full translations in EN, ES, PT, DE for both screens
   - Implemented placeholder support for dynamic content (e.g., `{bizOpp}` in Platform Management)
   - Fixed import paths and removed unnecessary null-aware operators
   - All changes verified with `flutter analyze` - no issues found
16. ✅ **Android Build v1.0.61+91**: Created new AAB with all localization changes
   - Build size: 55.6MB
   - Includes all multilingual updates for How It Works and Platform Management screens
   - Tree-shaking applied: MaterialIcons reduced by 98.9%
17. ✅ **Build Cache Cleanup**: Optimized project storage
   - Deleted Android cache directories (android/.gradle, android/build) - freed 43MB
   - Cleaned Flutter build caches via `flutter clean`
   - Project ready for fresh builds
18. ✅ **German UI Text Overflow Fixes**: Fixed multilingual text display issues
   - `lib/screens/dashboard_screen.dart`: Fixed stats card title overflow (reduced font size 18→16, added line height 1.2, enabled soft wrapping)
   - `lib/screens/dashboard_screen.dart`: Fixed action card title overflow (wrapped Text in Flexible widget, enabled 2-line display)
   - `lib/widgets/quick_prompts_widget.dart`: Fixed AI Coach welcome title overflow (wrapped Text in Flexible widget)
   - Verified all fixes with German locale hot reload testing
19. ✅ **Android Build v1.0.62+92**: Created AAB with German UI fixes
   - Build size: 55.6MB
   - All German text overflow issues resolved
   - Committed and pushed to GitHub with detailed commit message
20. ✅ **Major Disk Space Optimization**: Freed 14GB for iOS archive builds
   - Deleted Gradle cache: 5.5GB (`~/.gradle/caches`)
   - Deleted npm cache: 4.8GB (`~/.npm`)
   - Deleted Xcode DerivedData: 3.8GB (kept 165MB for active project)
   - Deleted CocoaPods cache: 155MB
   - Disk space improved: 7.1GB → 21GB available (97% → 90% capacity)
21. ✅ **iOS Build v1.0.64+94**: Prepared iOS release with debug symbols
   - Fixed localization build issue (regenerated `build/l10n_missing.txt` via `flutter gen-l10n`)
   - Successfully built iOS release with `flutter build ios --release --no-codesign`
   - Build size: 69.5MB with proper dSYM files
   - **Note**: Flutter.framework dSYM warning is a known Flutter issue and safe to ignore
     - Apple accepts submissions with this warning
     - Only Flutter's engine framework lacks dSYMs (app code has symbols)
     - Crash reporting works normally for app code
     - Thousands of Flutter apps in production with same warning

### Week of Nov 21
22. ✅ **Multi-Language Website Launch**: Complete Spanish and Portuguese websites
   - Created web-es/ (es.teambuildpro.com) and web-pt/ (pt.teambuildpro.com) directories
   - Fully localized homepages with 8 FAQ items (vs 6 on English site)
   - Fixed FAQ navigation links to point to /faq.html instead of /#faq
   - Added "View All Questions & Answers" button to both ES and PT homepages
   - Fixed FAQ accordion functionality using CSS class-based toggle
   - Contact forms with Google Analytics integration (internal IP filtering: 76.33.111.72)
   - Privacy policy and terms of service pages in both languages
   - Proper sitemap.xml files with hreflang tags for SEO

23. ✅ **Firebase Hosting Configuration**: Multi-site setup
   - Added ES and PT hosting targets to firebase.json
   - Configured cache headers: HTML (no-cache), assets (1 year)
   - Added 301 redirects for index.html → root path
   - Successfully deployed both sites (157 files each)

24. ✅ **Referral System Simplification** (v1.0.67+97):
   - Removed message type targeting (&t=X parameter)
   - Implemented language-specific domain routing
   - Share screen now routes to es.teambuildpro.com or pt.teambuildpro.com based on language selection
   - Cleaner URL structure: `https://es.teambuildpro.com/?new=ABC`
   - Updated share_screen.dart to use `_buildTargetedLink()` with domain selection

25. ✅ **Backend CORS Updates**:
   - Added es.teambuildpro.com and pt.teambuildpro.com to CORS whitelist
   - Updated functions/src/referrals.ts and compiled JavaScript files
   - Ensures API access from all language-specific domains

26. ✅ **SEO Improvements**:
   - Simplified EN sitemap.xml from 100+ URLs to essential pages only
   - Added hreflang tags linking EN/ES/PT versions for proper Google indexing
   - All three sites now properly cross-reference each other for multilingual SEO

27. ✅ **Email Campaign Utility Scripts**:
   - Created reset-failed-contacts.js for recovering failed email deliveries
   - Processes Mailgun CSV exports to reset contact status in Firestore
   - Enables retry of failed email sends from campaign

### Week of Nov 24
28. ✅ **Android Launch Campaign (Phase 2)**:
   - Created `sendAndroidLaunchCampaign` function in email-campaign-functions.js
   - Created email_resend_version.html template with Android launch announcement
   - Marked 2,077 pre-Nov 12 contacts for resend via mark-contacts-for-resend.js script
   - Fixed incorrect Google Play Store URL (com.teambuildpro.app → com.scott.ultimatefix)
   - Added ANDROID_CAMPAIGN_ENABLED environment variable for independent campaign control
   - Status: Ready to deploy after Phase 1 completion

29. ✅ **Mailgun Event Sync System**:
   - Created `syncMailgunEvents` function in email-campaign-functions.js
   - Automated sync of delivery/engagement data from Mailgun to Firestore
   - Runs 10 minutes after each campaign window with 2-hour lookback
   - Captures delivered, failed, opened, clicked events before 24-hour log expiration
   - Stores deliveryStatus, timestamps, counts, and failure reasons in Firestore
   - Added EMAIL_CAMPAIGN_SYNC_ENABLED environment variable
   - Successfully tested with 24-hour window to capture initial 3pm batch data (300 delivered, 15 failed, 6 opened)
   - Deployed and operational (Nov 24, 2025)

30. ✅ **Email Campaign Subject Line Update**:
   - Changed from "{{firstName}}, build your downline with AI-powered team tools"
   - To "The Recruiting App Built for Direct Sales"
   - Updated positioning aligns with new "AI Recruiting" branding
   - Removes MLM terminology that was causing spam filter issues

31. ✅ **Email Campaign Batch Size Increase**:
   - Increased from 25 emails per run to 75 emails per run
   - Daily capacity increased from 125 to 450 emails per day
   - Completion timeline reduced from ~44 days to ~8 days
   - Schedule remains 8am, 10am, 12pm, 1pm, 3pm, 6pm PT, Monday-Saturday

32. ✅ **Stephen Scott Author Website Migration to Firebase**:
   - Migrated stephenscott.us from Dreamhost to Firebase Hosting
   - Created sscott/ directory with complete website rebuild
   - 13 individual book pages with purchase links
   - Podcasts page (425 lines) with iframe embeds
   - About page (253 lines) with professional bio
   - Contact form integrated with Cloud Function (submitStephenScottContact)
   - Sitemap.xml (122 lines) for SEO
   - 301 redirects for legacy /blogs, /shop, /product URLs
   - Firebase hosting target: "sscott" pointing to sscott/public/
   - Build automation scripts in sscott/scripts/

33. ✅ **Bot Detection & Traffic Analysis System**:
   - Implemented comprehensive JavaScript bot detection across all sites
   - Created analyze-boardman-traffic.js (169 lines) for suspicious traffic investigation
   - Created analyze-city-traffic.js (217 lines) for general traffic monitoring
   - Browser fingerprinting and behavior analysis
   - Pattern detection for bot identification
   - Scripts: add-bot-detection.js, fix-bot-detection.js

34. ✅ **Analytics Infrastructure (GA4 + Mailgun Integration)**:
   - Created analytics/ workspace as separate npm project
   - fetch-combined-analytics.js (511 lines): Combined GA4 + Mailgun reporting
   - fetch-ga4-data.js (384 lines): Google Analytics 4 data extraction
   - Cross-references website traffic with email campaign performance
   - Service account authentication (ga4-service-account.json)
   - Daily/weekly/monthly reporting capabilities
   - Bot vs. human traffic differentiation

35. ✅ **Books Landing Pages for All Languages**:
   - Created books.html for English site with localized book covers
   - Created books.html for Spanish site (es.teambuildpro.com)
   - Created books.html for Portuguese site (pt.teambuildpro.com)
   - AI/MLM book catalog with purchase links
   - Consistent design across all three languages
   - SEO-optimized with proper hreflang tags

36. ✅ **Blog Expansion & Translation**:
   - 6 blog posts created for English site (web/blog/)
   - All 6 posts translated to Spanish (web-es/blog/)
   - All 6 posts translated to Portuguese (web-pt/blog/)
   - Blog index pages for all three languages
   - Topics: AI automation, recruiting best practices, platform comparisons
   - Localized meta tags and SEO optimization

37. ✅ **Language Switcher Implementation**:
   - Top-right placement on all EN/ES/PT pages
   - Preserves query string parameters (?new=, ?ref=) across language switches
   - Smart routing to corresponding pages in target language
   - Mobile-optimized responsive design
   - JavaScript-based with smooth user experience

38. ✅ **App Localization Phase 1 (60+ Translation Keys)**:
   - Created biz_opp_education_modal.dart widget for business opportunity education
   - Localized 14 Flutter screens with full translations (EN, ES, PT, DE)
   - Added 60+ new localization keys to app_*.arb files
   - Placeholder support for dynamic content (e.g., {bizOpp})
   - Database schema update: bizOppEducationShown field added to users collection
   - Fixed import paths and null-aware operators
   - Verified with flutter analyze - no issues

39. ✅ **SEO & Cross-Site Integration**:
   - Hreflang tags linking all language versions (EN/ES/PT)
   - Simplified EN sitemap.xml to essential pages only
   - Complete sitemaps for ES and PT sites with cross-references
   - Robots.txt files for all four sites (EN, ES, PT, stephenscott.us)
   - Proper canonical URL implementation across all sites
   - Google Analytics integration with internal IP filtering (76.33.111.72)

---

## 📞 Contact & Support

- **Creator**: Stephen Scott (sscott@info.teambuildpro.com)
- **Support Email**: support@teambuildpro.com
- **GitHub**: Private repository
- **Firebase Project**: teambuilder-plus-fe74d

---

## 🎯 Business Model

**NOT a business opportunity** - Team Build Pro is a B2B SaaS tool:
- **Revenue Model**: Subscription ($4.99/month after 30-day trial)
- **Target Market**: Direct sales professionals and their prospects
- **Competitive Advantage**: Only platform enabling pre-building teams before joining
- **Distribution**: iOS App Store, Google Play Store

---

*This knowledge base should be referenced at the start of each new AI assistant session to maintain context and understanding of Team Build Pro.*
