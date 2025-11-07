# Team Build Pro - Comprehensive Knowledge Base

**Last Updated**: 2025-11-06
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
- **24/7 AI Coach** for instant recruiting guidance
- **4 direct sponsors + 20 total downline members** = qualification milestones
- **120+ countries supported** with timezone-aware features
- **100+ direct sales companies** compatible
- **$4.99/month** after 30-day free trial
- **70% performance improvement** through client-side caching

---

## 🏗️ Technical Architecture

### Platform
- **Frontend**: Flutter (Dart) for iOS and Android
- **Backend**: Firebase (Firestore, Cloud Functions v2, Authentication, Remote Config)
- **Functions**: 50+ Cloud Functions handling real-time operations
- **Hosting**: Firebase Hosting for web properties
- **Email**: Mailgun for campaigns, SendGrid for transactional

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
**App ID**: 6751211622
**Package ID (Android)**: com.scott.ultimatefix

### App Store URLs
- **iOS**: https://apps.apple.com/us/app/team-build-pro-direct-sales/id6751211622
- **Android**: https://play.google.com/store/apps/details?id=com.scott.ultimatefix

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

### Current Campaign (Mailgun)
- **Subject**: `{{firstName}}, give your team the AI recruiting advantage`
- **Template**: `2version` (initial template)
- **Performance**: 6.2% open rate (winning combination)
- **Schedule**: 8am, 10am, 12pm, 3pm, 6pm PT, Monday-Saturday
- **Domain**: info.teambuildpro.com

### Target Audience
- Current direct sales professionals (not prospects)
- Goal: App downloads → Trial sign-ups → Paid conversions

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
- `functions/index.js` - All Cloud Functions
- `web/faq.html` - Dynamic FAQ implementation

---

## 🔄 Recent Major Changes (as of Nov 2025)

1. ✅ Updated FAQ with dynamic audience filtering (prospect vs professional)
2. ✅ Corrected message count from 8 to 16 throughout marketing materials
3. ✅ Fixed category dropdown filtering on FAQ page
4. ✅ Updated email campaign subject line and template
5. ✅ Standardized 75% quit rate statistic (was inconsistent)
6. ✅ Added "perpetual recruiting engine" messaging
7. ✅ Removed "proven/prove" language from messaging

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
