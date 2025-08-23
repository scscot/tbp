# CLAUDE.md - Team Build Pro Development Guide

## 🚀 Project Overview

**Team Build Pro** is a production-ready Flutter SaaS application for professional team building and networking. This is **NOT an MLM or network marketing company** - it's a legitimate subscription-based software tool designed for professionals in direct sales and team building industries.

### Key Facts
- **Status**: Ready for Apple App Store submission with maximum compliance
- **Architecture**: Flutter (Dart) with comprehensive Firebase backend
- **Performance**: 70% performance improvement through advanced client-side caching
- **Scale**: Supports 120+ countries with timezone-aware features
- **Security**: Enterprise-grade encryption and compliance protocols
- **Business Model**: Subscription-based SaaS tool (not a business opportunity)

### Core Purpose
Team Build Pro helps professionals:
- Build teams BEFORE officially joining opportunities (pre-build advantage)
- Manage existing teams with real-time analytics and intelligent search
- Communicate securely with team members via encrypted messaging
- Track performance metrics and team growth
- Maintain compliance with business opportunity guidelines

---

## 🏗️ Development Guidelines

### Flutter/Dart Best Practices
```dart
// Follow these patterns consistently throughout the codebase:

// 1. Use Provider for state management
Provider.of<AuthService>(context, listen: false)

// 2. Implement proper error handling with try-catch
try {
  await firestoreService.updateUser(uid, data);
} catch (e) {
  debugPrint('Error: $e');
  rethrow;
}

// 3. Use StreamBuilder for real-time data
StreamBuilder<UserModel?>(
  stream: authService.user,
  builder: (context, snapshot) { /* ... */ }
)

// 4. Implement proper debugging with debugPrint
debugPrint('🔐 AUTH_SERVICE: User authenticated: $uid');
```

### Performance Optimization Focus
The app achieves **70% performance improvement** through:

1. **Advanced Client-Side Caching** (`lib/services/network_service.dart`):
   ```dart
   static final Map<String, CachedResult> _cache = {};
   static const int _networkCountsCacheDuration = 5; // 5 minutes
   static const int _filteredNetworkCacheDuration = 3; // 3 minutes
   ```

2. **Optimized Firestore Queries**:
   - Array-based data model for efficient querying
   - Strategic use of `SetOptions(merge: true)`
   - Proper indexing for large datasets

3. **Memory Management**:
   - Cache cleanup with expiration policies
   - Size limits to prevent memory leaks
   - Proper disposal of streams and controllers

### Code Quality Standards
- **No comments** in code unless absolutely necessary for complex business logic
- Consistent naming conventions (`snake_case` for files, `camelCase` for variables)
- Comprehensive error handling with proper logging
- Use of `const` constructors where possible for performance

---

## 🔒 Critical Security Boundaries

### ⚠️ NEVER MODIFY THESE DIRECTORIES/FILES:
```
❌ secrets/                          # Contains sensitive credentials
❌ ios/Runner/GoogleService-Info.plist  # iOS Firebase configuration
❌ android/app/google-services.json     # Android Firebase configuration
❌ lib/firebase_options.dart           # Auto-generated Firebase options
❌ functions/serviceAccountKey.json     # Service account credentials
❌ **/AuthKey_*.p8                     # Apple authentication keys
❌ **/*credentials*.json               # Any credential files
```

### Security Protocols
1. **API Keys**: Only public Firebase API keys are in source code
2. **Service Accounts**: Private keys stored in `secrets/` directory
3. **Authentication**: Multi-provider auth (Google, Apple, Email/Password)
4. **Encryption**: All communications use enterprise-grade encryption
5. **Firestore Rules**: Comprehensive security rules with referral access

---

## 📁 File Classification Guide

### ✅ Safe to Modify (Core Development)
```
lib/screens/           # All UI screens
lib/widgets/          # Reusable UI components  
lib/services/         # Business logic services
lib/models/           # Data models
lib/config/app_colors.dart  # App styling
web/css/             # Web styling
web/*.html           # Landing pages (except sensitive ones)
```

### ⚠️ Handle with Care (Architectural)
```
lib/main.dart                # App entry point - core initialization
lib/config/app_constants.dart   # Contains Firebase config
firestore.rules              # Database security rules
firebase.json               # Firebase project configuration
pubspec.yaml                # Dependencies - impacts build
functions/index.js          # Cloud functions - affects backend
```

### 🚫 Do Not Touch (System Critical)
```
build/                  # Build artifacts
.dart_tool/            # Dart tooling
ios/Pods/              # iOS dependencies
android/build/         # Android build
node_modules/          # Node.js dependencies
secrets/               # All credential files
*.lock files           # Dependency locks
```

---

## 🔥 Firebase Architecture

### Core Services Integration
```yaml
Firebase Services Used:
  - Authentication: Multi-provider (Google, Apple, Email/Password)
  - Firestore: Real-time database with array-based data model
  - Cloud Functions: Node.js backend (us-central1 region)
  - Cloud Storage: Secure file storage for user content
  - Cloud Messaging: Push notifications and badge management
  - Remote Config: Dynamic app configuration
  - Analytics: User behavior tracking (privacy-compliant)
```

### Database Structure
```
users/                    # User profiles and authentication data
├── {userId}/
│   ├── notifications/    # User-specific notifications
│   └── [user fields]     # Profile data, upline references

chats/                    # Secure messaging system
├── {chatId}/
│   └── messages/         # Individual messages with encryption

admin_settings/           # Business opportunity configurations
└── {adminId}/           # Admin-specific settings and controls
```

### Cloud Functions Architecture
Located in `functions/index.js` with key operations:
- **Subscription Management**: Apple App Store Server-to-Server notifications
- **Badge Synchronization**: Cross-device notification badges
- **Daily Notifications**: Timezone-aware team growth notifications
- **Contact Forms**: Secure form processing for web companion
- **Member Details**: Optimized data retrieval with caching

### Security Rules Highlights
- **Referral Access**: Unauthenticated read access for website functionality
- **Network Visibility**: Users can see their upline/downline only
- **Admin Isolation**: Business opportunities have data separation
- **Encrypted Messaging**: Secure chat with participant validation

---

## ⚡ Performance & Caching Strategy

### Caching Implementation Details
The app implements sophisticated caching in `lib/services/network_service.dart`:

```dart
class CachedResult<T> {
  final T data;
  final DateTime timestamp;
  final String cacheKey;
  
  bool isExpired(int durationMinutes) {
    return DateTime.now().difference(timestamp).inMinutes >= durationMinutes;
  }
}
```

### Cache Duration Strategy
- **Network Counts**: 5 minutes (frequently changing data)
- **Filtered Networks**: 3 minutes (user-specific queries) 
- **Full Network**: 10 minutes (stable organizational data)
- **Cache Cleanup**: Automatic expiration and size management

### Memory Optimization
- **Static Cache**: Survives widget rebuilds, clears on app restart
- **Size Limits**: Maximum 50 cached items to prevent memory issues
- **Cleanup Strategy**: Remove expired entries first, then oldest entries

### Performance Monitoring
```dart
// Use debug prints for performance tracking
debugPrint('🚀 CACHE: Retrieved from cache - ${cached.getAgeMinutes()}min old');
debugPrint('⏱️ NETWORK: API call completed in ${stopwatch.elapsedMilliseconds}ms');
```

---

## 💼 Business Context

### Professional Networking Focus
Team Build Pro serves professionals in legitimate direct sales industries:
- **Pre-Build Advantage**: Build teams before joining opportunities
- **Analytics Dashboard**: Real-time team performance metrics
- **Global Scale**: Support for 120+ countries with timezone awareness
- **Compliance Tools**: Built-in guidelines and disclaimer management

### NOT a Business Opportunity
**Critical Understanding**: Team Build Pro is a software tool, not a business:
- Users pay monthly subscription fees to use the platform
- No money, commissions, or compensation paid to users
- No income opportunities or business ventures offered
- Strict compliance with App Store guidelines against MLM apps

### Subscription Model
- **Free Trial**: 30 days full access to premium features
- **Monthly Billing**: Simple, transparent subscription pricing
- **Apple Integration**: Complete App Store subscription compliance
- **Automatic Renewal**: Standard App Store subscription model

### Compliance Requirements
- **MLM Disclaimers**: Clear statements that this is NOT an MLM
- **Terms of Service**: Comprehensive legal protections
- **Privacy Policy**: GDPR and Apple privacy guideline compliance
- **Age Restrictions**: 17+ rating for business tool classification

---

## 🎨 Code Style & Architectural Patterns

### State Management Pattern
```dart
// Provider-based architecture with stream providers
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

### Service Layer Architecture
Each service follows this pattern:
```dart
class ServiceName {
  // Firebase/external dependencies
  final FirebaseFirestore _db = FirebaseFirestore.instance;
  
  // Public methods with proper error handling
  Future<ReturnType> methodName(params) async {
    try {
      // Implementation with debug logging
      debugPrint('🔧 SERVICE_NAME: Operation started');
      // ... logic ...
      debugPrint('✅ SERVICE_NAME: Operation completed');
      return result;
    } catch (e) {
      debugPrint('❌ SERVICE_NAME: Error - $e');
      rethrow;
    }
  }
}
```

### UI/UX Patterns
- **Material Design**: Consistent with Flutter Material guidelines
- **Responsive Layout**: Mobile-first with tablet support
- **Loading States**: Proper loading indicators and error handling
- **Navigation**: Declarative routing with named routes

### Error Handling Strategy
```dart
// Consistent error handling pattern
try {
  final result = await riskyOperation();
  return result;
} catch (e) {
  debugPrint('❌ CONTEXT: Specific error message: $e');
  // Show user-friendly error
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text('Operation failed. Please try again.'))
  );
  rethrow; // Let calling code handle if needed
}
```

---

## 🛡️ Security Protocols

### Authentication Security
- **Multi-Provider**: Google, Apple, Email/Password
- **Session Management**: Secure token handling with SharedPreferences
- **Biometric Support**: Optional biometric authentication
- **Auto-Logout**: Secure session expiration

### Data Protection
- **Encryption**: All sensitive data encrypted in transit and at rest
- **Access Controls**: Role-based access with Firestore security rules
- **Privacy Controls**: User consent and data minimization
- **GDPR Compliance**: Right to deletion and data portability

### API Security
```dart
// Cloud Functions security pattern
const functions = FirebaseFunctions.instanceFor(region: 'us-central1');
final callable = functions.httpsCallable('functionName');

try {
  final result = await callable.call(parameters);
  return result.data;
} on FirebaseFunctionsException catch (e) {
  debugPrint('Functions Error: ${e.code} - ${e.message}');
  rethrow;
}
```

### Compliance Monitoring
- **App Store Compliance**: Maximum compliance with all guidelines
- **Privacy Auditing**: Regular privacy impact assessments
- **Security Reviews**: Quarterly security architecture reviews
- **Legal Updates**: Continuous monitoring of regulatory changes

---

## 🤖 Claude Code Instructions

### When Working with This Codebase

#### ✅ DO:
1. **Analyze Before Modifying**: Always read related files to understand context
2. **Follow Patterns**: Mimic existing code structure and patterns
3. **Test Thoroughly**: Verify changes don't break existing functionality
4. **Update Documentation**: Keep this CLAUDE.md updated with significant changes
5. **Security First**: Always consider security implications of changes
6. **Performance Focus**: Maintain the 70% performance improvement standard

#### ❌ DON'T:
1. **Touch Sensitive Files**: Never modify files in security boundaries section
2. **Break Authentication**: Be extremely careful with auth-related changes
3. **Ignore Error Handling**: Always implement proper error handling
4. **Assume Dependencies**: Check if libraries/packages are already included
5. **Skip Testing**: Don't assume code works without verification

### Development Workflow
1. **Read Existing Code**: Understand current implementation
2. **Check Dependencies**: Verify required packages in `pubspec.yaml`
3. **Follow Patterns**: Use existing service patterns and architecture
4. **Test Incrementally**: Test changes in small increments
5. **Debug Logging**: Add appropriate debug prints for troubleshooting

### Common Tasks Guide
- **Adding Features**: Follow the service → screen → widget pattern
- **Firebase Changes**: Test with emulators first, then production
- **UI Updates**: Maintain responsive design and accessibility
- **Performance**: Always consider caching and optimization impact
- **Security**: Review any auth, data access, or API changes carefully

### Emergency Protocols
If you encounter:
- **Build Failures**: Check `pubspec.yaml` and dependency compatibility
- **Firebase Errors**: Verify configuration files haven't been corrupted
- **Performance Issues**: Review caching implementation and query optimization
- **Security Concerns**: Immediately flag and document security implications

---

## 📚 Key Documentation References

### External Resources
- [Flutter Documentation](https://docs.flutter.dev/)
- [Firebase for Flutter](https://firebase.google.com/docs/flutter/setup)
- [Apple App Store Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Console Policies](https://play.google.com/about/developer-content-policy/)

### Internal Resources
- `README.md`: Basic project setup information
- `Metadata_v4.md`: Comprehensive app store metadata and compliance info
- `firestore.rules`: Database security rules with detailed comments
- `functions/index.js`: Backend API documentation in comments

### Quick Commands
```bash
# Development
flutter run --debug
flutter build ios --release

# Firebase
firebase emulators:start
firebase deploy --only functions

# Testing
flutter test
flutter analyze
```

---

**Last Updated**: August 2025  
**Version Compatibility**: Flutter 3.3.0+, Firebase v10+  
**Maintained By**: Team Build Pro Development Team

---

*This documentation serves as the single source of truth for Team Build Pro development. Keep it updated with architectural changes and maintain security awareness at all times.*