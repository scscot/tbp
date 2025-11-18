# Team Build Pro - Comprehensive Knowledge Base

**Last Updated**: 2025-11-17
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
├── web/                   # Public website files
│   ├── index.html        # Homepage
│   ├── faq.html          # FAQ with dynamic filtering
│   ├── companies/        # Company-specific recruiting guides
│   └── blog/             # Blog posts
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

## 🌐 Website Structure (teambuildpro.com)

### Dynamic FAQ System
- **URL Parameter Detection**: `?new=` = Prospect view, otherwise = Professional view
- **Audience Filtering**: Uses `data-audience` attributes (prospect, professional, both)
- **Three Filter Systems**: Audience + Category dropdown + Search (unified)
- **SEO Optimization**: Dynamic meta tags based on audience type

### Key Pages
- `/` - Homepage with hero animation
- `/faq.html` - Dynamic FAQ (audience-aware)
- `/companies.html` - 60+ company-specific recruiting guides
- `/companies/ai-recruiting-[company].html` - Individual company pages
- `/blog/` - Blog index
- `/books/` - Free e-books for lead generation
- `/contact_us.html` - Contact form
- `/delete-account.html` - Account deletion (App Store requirement)

### SEO & Meta Tags
- Title: "AI Downline Builder - Recruit Smarter, Build Faster"
- Description: "Recruit smarter & empower your downline with AI. Pre-written messages, 24/7 coaching, real-time tracking. Free 30-day trial. $4.99/mo after."
- Focus keywords: AI downline builder, pre-build teams, direct sales recruiting

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
- **Subject**: `{{firstName}}, build your downline with AI-powered team tools`
- **Template**: `2version` (Mailgun template variant)
- **CTA Strategy**: Landing page routing (https://teambuildpro.com) with subtle text link "Learn more at TeamBuildPro.com"
- **Schedule**: 8am, 10am, 12pm, 3pm, 6pm PT, Monday-Saturday
- **Batch Size**: 25 emails per run (125 emails/day)
- **Domain**: info.teambuildpro.com
- **Data Source**: Firestore `emailCampaigns/master/contacts` collection

### Campaign Performance (as of Nov 2025)
- **Total Contacts**: 5,527
- **Total Sent**: 2,077 (37.6%)
- **Remaining**: 3,450 (62.4%)
- **Open Rate**: 30.9% (excellent - industry avg 15-25%)
- **Click Rate**: 5.5% (good - industry avg 2-3%)
- **Engagement Rate**: 36.4% (outstanding)
- **Delivery Rate**: 96.5% (2 failures out of 57 daily)
- **Completion Timeline**: ~28 days at current rate

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
- `lib/screens/how_it_works_screen.dart` - How It Works (fully localized in 4 languages)
- `lib/screens/platform_management_screen.dart` - Admin account creation (fully localized in 4 languages)
- `lib/widgets/biz_opp_education_modal.dart` - Business opportunity education modal
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
