# Referral Source Tracking & Fraud Prevention Schema

## Overview
This document outlines the Firestore schema enhancements for tracking referral sources and implementing basic fraud prevention measures in Team Build Pro.

## Firestore Schema Enhancements

### User Document Structure
```javascript
// users/{userId}
{
  // Existing fields...
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",

  // Enhanced referral tracking
  "referralSource": "constructor|branch|cache", // Attribution source
  "referralTimestamp": Timestamp,               // When referral was captured
  "referralCodeUsed": "88888888",              // Actual code used for registration
  "sponsorId": "sponsor-firebase-uid",         // Sponsor's Firebase UID

  // Fraud prevention fields
  "registrationIpAddress": "192.168.1.1",     // IP at time of registration
  "deviceFingerprint": "device-hash",         // Device identification
  "referralValidationStatus": "valid|suspicious|flagged",

  // Audit trail
  "createdAt": Timestamp,
  "lastUpdated": Timestamp,
  "updatedBy": "system|user|admin"
}
```

### Referral Audit Log Collection
```javascript
// referralAudits/{auditId}
{
  "userId": "user-firebase-uid",
  "action": "referral_capture|referral_overwrite|referral_validation",
  "oldReferralCode": "88888888",
  "newReferralCode": "99999999",
  "oldSource": "constructor",
  "newSource": "branch",
  "userDecision": "accepted|rejected|automatic",
  "timestamp": Timestamp,
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "deviceId": "device-uuid",
  "sessionId": "session-uuid"
}
```

### Fraud Detection Flags Collection
```javascript
// fraudFlags/{flagId}
{
  "userId": "user-firebase-uid",
  "flagType": "self_referral|duplicate_device|rapid_registration|suspicious_ip",
  "severity": "low|medium|high|critical",
  "description": "User attempted to use own referral code",
  "evidence": {
    "referralCode": "88888888",
    "sponsorId": "same-as-user-id",
    "ipAddress": "192.168.1.1",
    "deviceFingerprint": "duplicate-hash"
  },
  "status": "flagged|reviewed|resolved|false_positive",
  "reviewedBy": "admin-uid",
  "reviewedAt": Timestamp,
  "createdAt": Timestamp
}
```

## Fraud Prevention Rules

### 1. Self-Referral Detection
```javascript
// In registerUser Cloud Function
if (sponsorReferralCode) {
  const sponsorUser = await admin.firestore()
    .collection('users')
    .where('referralCode', '==', sponsorReferralCode)
    .get();

  if (!sponsorUser.empty) {
    const sponsorData = sponsorUser.docs[0].data();

    // Check if user is trying to refer themselves
    if (sponsorData.email === registrationData.email) {
      await createFraudFlag({
        userId: newUserId,
        flagType: 'self_referral',
        severity: 'high',
        description: 'User attempted to use own referral code',
        evidence: {
          referralCode: sponsorReferralCode,
          userEmail: registrationData.email,
          sponsorEmail: sponsorData.email
        }
      });

      // Block registration or remove referral
      delete registrationData.sponsorReferralCode;
    }
  }
}
```

### 2. TTL (Time-To-Live) on Cached Codes
```javascript
// In SessionManager (Flutter)
class SessionManager {
  static const int _referralCacheTTLHours = 24; // 24-hour expiry

  Future<Map<String, String?>?> getReferralData() async {
    final prefs = await SharedPreferences.getInstance();
    final cachedData = prefs.getString('referral_data');

    if (cachedData != null) {
      final data = jsonDecode(cachedData);
      final timestamp = DateTime.fromMillisecondsSinceEpoch(data['timestamp']);

      // Check if cache has expired
      if (DateTime.now().difference(timestamp).inHours > _referralCacheTTLHours) {
        await clearReferralData();
        debugPrint('🔍 SESSION: Referral cache expired, cleared');
        return null;
      }

      return {
        'referralCode': data['referralCode'],
        'sponsorName': data['sponsorName'],
        'queryType': data['queryType'],
        'source': data['source']
      };
    }
    return null;
  }

  Future<void> setReferralData(String referralCode, String sponsorName,
      {String? queryType, String? source}) async {
    final prefs = await SharedPreferences.getInstance();

    final data = {
      'referralCode': referralCode,
      'sponsorName': sponsorName,
      'queryType': queryType,
      'source': source ?? 'unknown',
      'timestamp': DateTime.now().millisecondsSinceEpoch
    };

    await prefs.setString('referral_data', jsonEncode(data));
  }
}
```

### 3. Device Fingerprinting
```javascript
// Enhanced registration data capture
const registrationData = {
  // Existing fields...
  referralSource: data.referralSource,

  // Fraud prevention data
  registrationIpAddress: context.rawRequest.ip,
  deviceFingerprint: generateDeviceFingerprint(context.rawRequest),
  userAgent: context.rawRequest.headers['user-agent'],
  timestamp: admin.firestore.FieldValue.serverTimestamp()
};

function generateDeviceFingerprint(request) {
  const components = [
    request.headers['user-agent'],
    request.headers['accept-language'],
    request.headers['accept-encoding'],
    request.ip
  ];

  return crypto.createHash('sha256')
    .update(components.join('|'))
    .digest('hex');
}
```

### 4. Rapid Registration Detection
```javascript
// Check for suspicious registration patterns
async function checkRapidRegistration(ipAddress, deviceFingerprint) {
  const recentRegistrations = await admin.firestore()
    .collection('users')
    .where('registrationIpAddress', '==', ipAddress)
    .where('createdAt', '>', new Date(Date.now() - 3600000)) // Last hour
    .get();

  if (recentRegistrations.size > 3) {
    return {
      flagType: 'rapid_registration',
      severity: 'medium',
      description: `${recentRegistrations.size} registrations from same IP in last hour`,
      evidence: {
        ipAddress,
        registrationCount: recentRegistrations.size,
        timeWindow: '1 hour'
      }
    };
  }
  return null;
}
```

## Analytics Integration

### Custom Events for Tracking
```javascript
// In Flutter app - track referral attribution
void trackReferralAttribution(String source, String? referralCode) {
  FirebaseAnalytics.instance.logEvent(
    name: 'referral_attribution',
    parameters: {
      'source': source, // constructor|branch|cache
      'has_referral_code': referralCode != null,
      'referral_code_length': referralCode?.length ?? 0,
    }
  );
}

// Track overwrite decisions
void trackReferralOverwrite(String decision, String oldSource, String newSource) {
  FirebaseAnalytics.instance.logEvent(
    name: 'referral_overwrite',
    parameters: {
      'decision': decision, // accepted|rejected
      'old_source': oldSource,
      'new_source': newSource,
    }
  );
}
```

### Cloud Function Analytics
```javascript
// Track fraud detection events
async function logFraudEvent(eventType, details) {
  await admin.firestore().collection('analytics').add({
    type: 'fraud_detection',
    eventType, // self_referral|rapid_registration|etc.
    details,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  // Also log to Cloud Logging for ops team
  console.log(`🚨 FRAUD DETECTION: ${eventType}`, details);
}
```

## Security Rules Updates

### Firestore Security Rules
```javascript
// Allow users to read their own referral audit logs
match /referralAudits/{auditId} {
  allow read: if request.auth != null &&
    resource.data.userId == request.auth.uid;
  allow write: if false; // Only Cloud Functions can write
}

// Fraud flags are admin-only
match /fraudFlags/{flagId} {
  allow read, write: if isAdmin(request.auth.uid);
}

// Enhanced user document security
match /users/{userId} {
  allow read, write: if request.auth != null &&
    request.auth.uid == userId;

  // Prevent users from modifying fraud prevention fields
  allow update: if request.auth != null &&
    request.auth.uid == userId &&
    !('referralValidationStatus' in request.resource.data.diff(resource.data).affectedKeys()) &&
    !('deviceFingerprint' in request.resource.data.diff(resource.data).affectedKeys()) &&
    !('registrationIpAddress' in request.resource.data.diff(resource.data).affectedKeys());
}
```

## Implementation Checklist

### Phase 1: Basic Tracking
- [x] Add referralSource field to registration data
- [ ] Implement referral audit logging
- [ ] Add TTL to cached referral codes
- [ ] Track overwrite decisions in analytics

### Phase 2: Fraud Prevention
- [ ] Implement self-referral detection
- [ ] Add device fingerprinting
- [ ] Create fraud flags collection
- [ ] Set up rapid registration detection

### Phase 3: Monitoring & Alerts
- [ ] Dashboard for fraud flag review
- [ ] Email alerts for high-severity flags
- [ ] Regular audit reports
- [ ] Integration with customer support tools

## Monitoring Queries

### Firestore Queries for Fraud Detection
```javascript
// Find users with suspicious referral patterns
db.collection('users')
  .where('referralValidationStatus', '==', 'suspicious')
  .orderBy('createdAt', 'desc')

// Find recent fraud flags
db.collection('fraudFlags')
  .where('status', '==', 'flagged')
  .where('createdAt', '>', yesterday)
  .orderBy('severity', 'desc')

// Audit referral overwrites
db.collection('referralAudits')
  .where('action', '==', 'referral_overwrite')
  .where('userDecision', '==', 'accepted')
  .orderBy('timestamp', 'desc')
```

### Analytics Queries
```javascript
// Track referral source distribution
SELECT
  referralSource,
  COUNT(*) as registrations
FROM users
WHERE createdAt > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY referralSource

// Monitor fraud detection effectiveness
SELECT
  flagType,
  severity,
  COUNT(*) as flags,
  SUM(CASE WHEN status = 'false_positive' THEN 1 ELSE 0 END) as false_positives
FROM fraudFlags
WHERE createdAt > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
GROUP BY flagType, severity
```

## Data Retention Policy

### Audit Logs
- **Retention Period**: 2 years
- **Archive Strategy**: Move to cold storage after 6 months
- **Deletion Policy**: Automated cleanup after retention period

### Fraud Flags
- **Retention Period**: 5 years (compliance requirement)
- **Review Cycle**: Monthly review of unresolved flags
- **False Positive Learning**: Use for ML model training

---

**Security Note**: All PII in fraud logs should be hashed or encrypted. IP addresses and device fingerprints are considered privacy-sensitive data and should comply with GDPR/CCPA requirements.