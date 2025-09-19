# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Team Build Pro Development Guide

## 🚀 Project Overview

**Team Build Pro** is a production-ready Flutter SaaS application for professional team building and networking. This is **NOT an MLM or network marketing company** - it's a legitimate subscription-based software tool designed for professionals in direct sales and team building industries.

### Key Technical Facts
- **Status**: Ready for Apple App Store submission with maximum compliance
- **Architecture**: Flutter (Dart) with comprehensive Firebase backend
- **Performance**: 70% performance improvement through advanced client-side caching
- **Scale**: Supports 120+ countries with timezone-aware features
- **Security**: Enterprise-grade encryption and compliance protocols
- **Business Model**: Subscription-based SaaS tool (not a business opportunity)

---

## 🛠️ Essential Development Commands

### Flutter Commands
```bash
# Development and testing
flutter run --debug                    # Run app in debug mode
flutter run --release                  # Run app in release mode
flutter build ios --release            # Build iOS release
flutter build appbundle               # Build Android App Bundle
flutter test                          # Run all tests
flutter analyze                       # Analyze code for issues
flutter clean                         # Clean build cache

# Package management
flutter pub get                       # Install dependencies
flutter pub upgrade                   # Upgrade packages
```

### Firebase Functions Commands
```bash
# Navigate to functions directory first
cd functions

# Development
npm run serve                          # Start local emulator
npm run shell                         # Interactive functions shell
npm run logs                          # View function logs

# Code quality
npm run lint                          # Lint JavaScript code
npm run lint:fix                      # Auto-fix linting issues
npm run format                        # Format code with Prettier
npm run format:check                  # Check code formatting

# Deployment
npm run deploy                        # Deploy functions to production
firebase deploy --only functions      # Alternative deploy command
```

### Firebase Project Commands
```bash
# Emulator suite
firebase emulators:start              # Start all emulators
firebase emulators:start --only functions,firestore  # Specific services

# Database
firebase firestore:indexes            # Manage Firestore indexes
firebase firestore:rules:list         # List security rules

# Monitoring
firebase functions:log                 # Real-time function logs
firebase functions:log --only functionName  # Specific function logs
```

---

## 🏗️ Core Architecture Overview

### Firebase Functions v2 Architecture (50+ Functions)
The backend contains 50+ Cloud Functions handling:

**Critical Functions:**
- `registerUser` - User registration with sponsor resolution system
- `notifyOnMilestoneReached` - Milestone notifications (directSponsorCount/totalTeamCount)
- `createNotificationWithPush` - Unified notification + FCM system
- `handleAppleSubscriptionNotification` - App Store Server-to-Server notifications
- `sendDailyTeamGrowthNotifications` - Scheduled team growth notifications

**FCM Notification System:**
- **Three-tier token resolution**: field → array[0] → subcollection (freshest)
- **Helper vs Trigger modes**: Controlled by environment variables
- **Milestone logging**: Special handling for milestone notifications
- **Badge synchronization**: Cross-device notification badges

### Flutter State Management
```dart
// Provider-based architecture with StreamProviders
MultiProvider(
  providers: [
    StreamProvider<UserModel?>(
      create: (context) => context.read<AuthService>().user,
      initialData: null,
    ),
    StreamProvider<AdminSettingsModel?>(
      create: (context) => context.read<AuthService>().adminSettings,
      initialData: null,
    ),
  ],
  child: MyApp(),
)
```

### Database Structure (Firebase Firestore)
```
users/{userId}/                       # User profiles with Firebase UIDs
├── notifications/{notificationId}    # User-specific notifications
├── fcmTokens/{token}                # FCM token subcollection
└── [user fields]                    # Profile data, upline_refs arrays

chats/{chatId}/                      # Secure messaging system
└── messages/{messageId}             # Individual encrypted messages

admin_settings/{adminId}/            # Business opportunity configurations
referralCodes/{code}/                # Referral code → Firebase UID mapping
```

### Critical UID vs UUID Architecture
**IMPORTANT**: The system uses Firebase UIDs (authentication IDs) throughout, not UUIDs:
- `upline_refs` arrays contain Firebase UIDs
- `sponsor_id` fields contain Firebase UIDs
- All Cloud Functions expect Firebase UIDs
- Sponsor resolution system converts referral codes/UUIDs to Firebase UIDs

---

## 🔔 FCM Notification System Architecture

### Notification Flow
1. **Event Trigger** → Cloud Function (milestone, chat, etc.)
2. **createNotificationWithPush()** → Unified handler
3. **Token Resolution** → Three-tier FCM token lookup
4. **Push Delivery** → Firebase Admin SDK messaging
5. **Badge Update** → Cross-platform badge synchronization

### Key Implementation Details
```javascript
// Three-tier token resolution in functions/index.js
async function resolveBestFcmTokenForUser(userRef, userData) {
  // 1. Direct field: userData.fcmToken
  // 2. Array fallback: userData.fcmTokens[0]
  // 3. Subcollection: userRef.collection('fcmTokens')
}

// Milestone notifications with caching
exports.notifyOnMilestoneReached = onDocumentUpdated("users/{userId}", async (event) => {
  // updateMask filtering for efficiency
  // Remote Config cached thresholds
  // Idempotent notification IDs
});
```

### Environment Configuration
```bash
# Functions environment variables
NOTIFICATIONS_DELIVERY_MODE=helper    # 'helper' or 'trigger'
NOTIFICATIONS_ENABLE_TRIGGER=false    # Enable/disable triggers
DEBUG_ENABLE_EXTRA_EXPORTS=false     # Debug functions
```

---

## 📱 Performance & Caching Strategy

### Client-Side Caching (lib/services/network_service.dart)
```dart
class CachedResult<T> {
  final T data;
  final DateTime timestamp;
  final String cacheKey;

  bool isExpired(int durationMinutes) {
    return DateTime.now().difference(timestamp).inMinutes >= durationMinutes;
  }
}

// Cache duration strategy
static const int _networkCountsCacheDuration = 5;     // 5 minutes
static const int _filteredNetworkCacheDuration = 3;   // 3 minutes
static const int _fullNetworkCacheDuration = 10;     // 10 minutes
```

### Remote Config Caching (Functions)
```javascript
// Milestone threshold caching (60-second cache)
let __milestoneRC = { directMin: 4, teamMin: 20, ts: 0 };
async function getMilestoneThresholds() {
  const now = Date.now();
  if (now - __milestoneRC.ts < 60000) return __milestoneRC;
  // Fetch from Remote Config...
}
```

---

## 🔒 Security & Compliance Architecture

### Authentication Security
- **Multi-Provider**: Google, Apple, Email/Password
- **Firebase UID Based**: All user references use authentication UIDs
- **Biometric Support**: Optional biometric authentication
- **Session Management**: Secure token handling with SharedPreferences

### Critical Security Boundaries
**⚠️ NEVER MODIFY THESE:**
```
❌ secrets/                          # Contains sensitive credentials
❌ ios/Runner/GoogleService-Info.plist  # iOS Firebase configuration
❌ android/app/google-services.json     # Android Firebase configuration
❌ lib/firebase_options.dart           # Auto-generated Firebase options
❌ functions/serviceAccountKey.json     # Service account credentials
❌ **/AuthKey_*.p8                     # Apple authentication keys
```

### Firestore Security Rules
- **Referral Access**: Unauthenticated read access for website functionality
- **Network Visibility**: Users can see their upline/downline only via upline_refs
- **Admin Isolation**: Business opportunities have data separation
- **UID-based Security**: All rules validate Firebase UIDs, not UUIDs

---

## 🧪 Testing & Development Workflow

### Local Development Setup
```bash
# 1. Start Firebase emulators
firebase emulators:start

# 2. Run Flutter app pointing to emulators (modify main.dart)
flutter run --debug

# 3. Monitor function logs
npm run logs --prefix functions
```

### Testing Milestone Notifications
```bash
# Test milestone system with specific user
firebase functions:log --only notifyOnMilestoneReached

# Monitor FCM delivery
firebase functions:log | grep "PUSH MILESTONE"

# Check sponsor resolution
firebase functions:log | grep "REGISTER RESOLVE"
```

### Code Quality Requirements
- **No comments** in code unless absolutely necessary
- **Consistent error handling** with proper logging patterns
- **Firebase UID consistency** - never mix with UUIDs
- **Performance focus** - maintain 70% improvement standard

---

## 📋 Common Development Tasks

### Adding New Cloud Functions
1. Add function to `functions/index.js`
2. Follow existing patterns for error handling
3. Use Firebase UIDs consistently
4. Add proper logging with emojis for visibility
5. Test with emulators before deployment

### Modifying Notification System
1. **Never bypass** `createNotificationWithPush()`
2. Use stable `notifId` patterns for idempotency
3. Consider FCM delivery modes (helper vs trigger)
4. Test badge synchronization across devices

### Firebase Security Rules Updates
1. Test changes with emulator suite
2. Verify UID-based access patterns
3. Test unauthenticated referral access
4. Deploy incrementally and monitor

### Performance Optimization
1. **Check caching** - both client and server side
2. **Monitor Remote Config** usage and caching
3. **Optimize Firestore queries** - use array-contains where possible
4. **Review FCM token resolution** efficiency

---

## 🚨 Critical Patterns & Anti-Patterns

### ✅ DO:
- Use Firebase UIDs throughout the system
- Follow three-tier FCM token resolution
- Implement proper error handling with emoji logging
- Use Provider pattern for state management
- Cache expensive operations (network calls, Remote Config)
- Test with Firebase emulators

### ❌ DON'T:
- Mix Firebase UIDs with UUIDs
- Bypass the unified notification system
- Modify security-critical files
- Ignore FCM delivery mode environment variables
- Skip idempotency checks for notifications
- Deploy without emulator testing

---

## 🔧 Troubleshooting Guide

### Common Issues:

**FCM Notifications Not Delivered:**
```bash
# Check token resolution logs
firebase functions:log | grep "PUSH:"

# Verify delivery mode
echo $NOTIFICATIONS_DELIVERY_MODE

# Check helper vs trigger configuration
firebase functions:log | grep "NOTIFICATION_CREATED"
```

**Milestone Notifications Missing:**
```bash
# Check sponsor resolution
firebase functions:log | grep "REGISTER RESOLVE"

# Verify threshold configuration
firebase functions:log | grep "MILESTONE THRESHOLDS"

# Check updateMask filtering
firebase functions:log | grep "MILESTONE EVT"
```

**UID/UUID Conflicts:**
- Verify all `upline_refs` contain Firebase UIDs
- Check sponsor resolution in `registerUser`
- Ensure database queries use proper UIDs

---

## 📚 Key File References

### Core Architecture Files:
- `lib/main.dart` - App initialization and provider setup
- `lib/services/auth_service.dart` - Authentication and user management
- `lib/services/network_service.dart` - Advanced caching implementation
- `lib/services/fcm_service.dart` - FCM token management
- `functions/index.js` - All 50+ Cloud Functions

### Configuration Files:
- `pubspec.yaml` - Flutter dependencies and app configuration
- `functions/package.json` - Node.js dependencies and scripts
- `firebase.json` - Firebase project configuration
- `firestore.rules` - Database security rules

### Documentation:
- `documents/CLAUDE.md` - This file (comprehensive development guide)
- App store metadata in various `Metadata_v*.md` files
- Function documentation embedded in `functions/index.js` comments

---

**Last Updated**: September 2025
**Flutter Version**: 3.3.0+
**Firebase Functions**: v2 (Node.js 20)
**Critical Systems**: FCM, Milestone Notifications, Sponsor Resolution

---

*This documentation serves as the single source of truth for Team Build Pro development. The system uses Firebase UIDs consistently throughout - never mix with UUIDs. The notification system is production-ready with enterprise-grade FCM handling.*