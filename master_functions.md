# Team Build Pro - Master Functions Reference

## Overview
Team Build Pro is a comprehensive SaaS platform for professional team building and networking. This document provides a complete reference of all Cloud Functions, database operations, and key web functionality.

---

## 🔐 Authentication & User Management

### `registerUser`
**Purpose**: Creates new user accounts with referral tracking and team hierarchy  
**Type**: Callable Function  
**Key Features**:
- Creates Firebase Auth user and Firestore document atomically
- Processes sponsor and admin referral codes
- Calculates user level and upline references
- Updates sponsor team counts
- Initializes trial subscription (30-day)
- Auto-generates unique referral codes
- Handles cleanup on registration failure

**Parameters**: email, password, firstName, lastName, sponsorReferralCode, adminReferralCode, role, country, state, city

### `getUserByReferralCode`
**Purpose**: Retrieves sponsor information for new user signups  
**Type**: HTTP Request Function  
**Key Features**:
- Returns sponsor details (name, photo, completion status)
- Provides business opportunity name for personalization
- Returns available countries for admin's network
- Used by registration form for sponsor validation

**Parameters**: code (query parameter)

---

## 🌐 Network & Team Management

### `getNetwork`
**Purpose**: Retrieves complete team network for authenticated user  
**Type**: Callable Function  
**Key Features**:
- Returns all users in downline using `upline_refs` array
- Serializes Firestore data for client consumption
- Includes all team member details

### `getNetworkCounts`
**Purpose**: Provides dashboard statistics for team performance  
**Type**: Callable Function  
**Returns**:
- Total network size
- New members in last 24 hours
- Qualified members count
- Members who joined opportunity
- Direct sponsors count

### `getFilteredNetwork`
**Purpose**: Advanced team filtering with pagination  
**Type**: Callable Function  
**Filters Available**:
- `last24`: Members added in past 24 hours
- `newQualified`: Members with qualification dates
- `joinedOpportunity`: Members who joined business opportunity
**Features**:
- Optimized querying with proper indexing
- Pagination support (limit/offset)
- Total count and hasMore indicators

### `getNewMembersYesterdayCount`
**Purpose**: Specific count of new members from previous day  
**Type**: Callable Function  
**Use Case**: Daily progress tracking and notifications

---

## 💳 Apple App Store Subscriptions

### `handleAppleSubscriptionNotification` (V1)
**Purpose**: Legacy Apple server-to-server notification handler  
**Type**: HTTP Request Function  
**Handles**: INITIAL_BUY, CANCEL, DID_FAIL_TO_RENEW, DID_RENEW, etc.

### `handleAppleSubscriptionNotificationV2`
**Purpose**: Modern Apple App Store Server Notifications V2  
**Type**: HTTP Request Function  
**Key Features**:
- JWT signature verification using Apple certificates
- Comprehensive notification type handling
- Enhanced security with certificate chain validation
- Supports all V2 notification types (SUBSCRIBED, EXPIRED, REFUND, etc.)

### `validateAppleReceipt`
**Purpose**: Manual receipt validation with Apple  
**Type**: Callable Function  
**Features**:
- Production and sandbox environment support
- Receipt verification with Apple's servers
- Subscription status determination
- User subscription status updates

### `checkUserSubscriptionStatus`
**Purpose**: Real-time subscription status checking  
**Type**: Callable Function  
**Returns**:
- Current subscription status
- Trial validity and days remaining
- Expiration status and dates
- Grace period information

---

## 🤖 Google Play Subscriptions

### `validateGooglePlayPurchase`
**Purpose**: Google Play purchase token validation  
**Type**: Callable Function  
**Features**:
- Integration with Google Play Developer API
- Purchase token verification
- Subscription status updates
- Auto-renewal status checking

### `handleGooglePlayNotification`
**Purpose**: Google Play Real-time Developer Notifications  
**Type**: HTTP Request Function  
**Handles**: SUBSCRIPTION_RECOVERED, RENEWED, CANCELED, PURCHASED, ON_HOLD, etc.  
**Features**:
- Base64 message decoding
- Test notification support
- Purchase token mapping to users

---

## 📅 Scheduled Functions

### `checkExpiredTrials`
**Purpose**: Daily trial expiration monitoring  
**Schedule**: 9 AM UTC daily  
**Actions**:
- Identifies trials older than 30 days
- Updates status to 'expired'
- Sends expiration notifications

### `checkTrialsExpiringSoon`
**Purpose**: Trial expiration warnings  
**Schedule**: 9 AM UTC daily  
**Actions**:
- Finds trials expiring in 3 days
- Sends warning notifications
- Encourages subscription upgrades

### `checkSubscriptionsExpiringSoon`
**Purpose**: Paid subscription expiration warnings  
**Schedule**: 9 AM UTC daily  
**Features**:
- Prevents duplicate warnings with date tracking
- Handles both active and cancelled subscriptions
- 3-day advance warning system

---

## 🔔 Notification System

### `sendPushNotification`
**Purpose**: Automated push notifications on new notifications  
**Type**: Firestore Trigger (onCreate)  
**Trigger Path**: `users/{userId}/notifications/{notificationId}`  
**Features**:
- FCM (Firebase Cloud Messaging) integration
- iOS APNS and Android notification support
- Route and parameter passing for deep links
- Centralized badge count updates

### `updateUserBadge`
**Purpose**: Centralized badge count calculation  
**Type**: Helper Function  
**Calculates**:
- Unread notifications count
- Unread chat messages count
- Total badge number for app icon
**Optimizations**:
- Transaction-based consistency
- Pagination for large datasets
- Error resilience with fallbacks

---

## 💬 Chat & Messaging

### `onNewChatMessage`
**Purpose**: Processes new chat messages  
**Type**: Firestore Trigger (onCreate)  
**Trigger Path**: `chats/{threadId}/messages/{messageId}`  
**Features**:
- Updates chat metadata
- Triggers push notifications
- Manages read/unread status
- Badge count updates

---

## 📧 Email & Communication

### `submitContactForm`
**Purpose**: Callable contact form submission  
**Type**: Callable Function

### `submitContactFormHttp`
**Purpose**: HTTP contact form for website  
**Type**: HTTP Request Function  
**Features**:
- reCAPTCHA Enterprise verification
- SendGrid email delivery
- Score-based spam protection
- Comprehensive logging

### `sendDemoInvitation`
**Purpose**: Android demo invitation emails  
**Type**: HTTP Request Function  
**Features**:
- Professional HTML email templates
- SendGrid integration
- Demo download instructions
- Branded messaging

---

## 🧪 Testing & Utilities

### `testAppleNotificationV2Setup`
**Purpose**: Apple notification endpoint validation  
**Type**: Callable Function  
**Returns**: Endpoint URL and configuration status

### `testGooglePlayNotificationSetup`
**Purpose**: Google Play notification endpoint validation  
**Type**: Callable Function  
**Returns**: Endpoint URL and configuration status

---

## 🌐 Web Frontend Functionality

### Android Preview Form (`index.html`)
**Location**: Main website landing page  
**Purpose**: Lead capture for Android beta testing  

**Key Features**:
- **Smart Device Detection**: Automatically shows appropriate download options based on user device
- **Dynamic Button System**: 
  - iOS users see App Store download first, Android preview second
  - Android users see Android preview first, App Store second
  - Desktop users see both options prominently
- **Lead Capture**: Collects user information for demo access
- **Firestore Integration**: Stores leads in `launch_notifications` collection

**Data Collected**:
- firstName, lastName, email
- wantDemo (boolean)
- deviceType ('android')
- timestamp, source, userAgent, referrer
- refUrl (current page URL with parameters)
- emailSent (boolean for tracking)

**Smart Features**:
- **URL Parameter Preservation**: Maintains `?ref=` and `?new=` parameters through App Store links
- **Referral Attribution**: Tracks referral sources and landing pages
- **Email Status Tracking**: Prevents duplicate demo invitations
- **Responsive Design**: Mobile-optimized modal and forms

---

## 🔄 Helper Functions & Utilities

### `updateUserSubscription`
**Purpose**: Centralized subscription status updates  
**Features**:
- Consistent status management
- Expiry date handling
- Timestamp tracking

### `createSubscriptionNotification`
**Purpose**: Generates user notifications for subscription events  
**Types**: active, cancelled, expired, expiring_soon, refunded, revoked

### `serializeData`
**Purpose**: Converts Firestore data types for client consumption  
**Handles**: Timestamps, DocumentReferences, nested objects

### `getBusinessOpportunityName`
**Purpose**: Retrieves business opportunity names from admin settings  
**Fallback**: Returns default name if admin settings not found

### `getTimezoneFromLocation`
**Purpose**: Determines user timezone from country/state information  
**Used**: During user registration for localized notifications

---

## 📊 Database Collections

### `users`
**Primary user data with subscription tracking**
- Authentication info, profile data
- Team hierarchy (upline_refs, sponsor_id, level)
- Subscription status and trial dates
- FCM tokens and notification preferences

### `launch_notifications`
**Beta tester and lead management**
- Email collection for Android demo
- Referral tracking and attribution
- Email status to prevent duplicates

### `admin_settings`
**Business opportunity configurations**
- Country availability
- Business opportunity names
- Admin-specific settings

### `chats` & `chats/{id}/messages`
**Secure messaging system**
- Participant management
- Read/unread status tracking
- Real-time message delivery

---

## 🚀 Performance Optimizations

### Caching Strategy
- **Client-side caching**: 5-minute network counts, 3-minute filtered results
- **Database indexing**: Optimized for array-contains queries
- **Pagination**: Prevents large data transfers
- **Transaction usage**: Ensures data consistency

### Error Handling
- **Atomic operations**: Registration rollback on failure
- **Retry mechanisms**: FCM delivery with exponential backoff
- **Graceful degradation**: Badge updates continue on partial failures
- **Comprehensive logging**: Debug information for troubleshooting

### Security Features
- **JWT verification**: Apple notification signature validation
- **reCAPTCHA**: Spam protection on forms
- **Certificate validation**: Apple certificate chain verification
- **Input sanitization**: Prevents injection attacks

---

## 📋 Development Notes

### Environment Requirements
- Node.js 20+ for Cloud Functions
- Firebase Functions v2 API
- SendGrid API key for email delivery
- Apple App Store certificates for subscription validation
- Google Play Developer API access

### Monitoring & Maintenance
- **Cloud Functions logs**: Comprehensive error tracking
- **Badge count accuracy**: Centralized calculation prevents inconsistencies
- **Subscription sync**: Real-time updates from app stores
- **Email delivery**: SendGrid analytics and delivery tracking

---

*Last Updated: August 2025*  
*Total Functions: 25+ Cloud Functions, 1 major web integration*  
*Architecture: Firebase Functions v2, Firestore, SendGrid, FCM*